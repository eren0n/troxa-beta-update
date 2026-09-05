"""
Management command: bootstrap_fingerprint
=========================================

Backfills Agent 1 analysis for existing WinningStatic uploads and
rated GeneratedCreative records, then triggers merge/synthesis.

All Agent 1 calls run concurrently (ThreadPoolExecutor, 8 workers by default).

Usage
-----
  # All workspaces (skip already-analysed)
  python manage.py bootstrap_fingerprint --all

  # Single workspace by name (case-insensitive substring match)
  python manage.py bootstrap_fingerprint epicsweep

  # Force re-analyse everything even if already done
  python manage.py bootstrap_fingerprint epicsweep -f
  python manage.py bootstrap_fingerprint --all -f

Flags
-----
  --all            Process every workspace.
  -f / --force     Re-analyse items that already have an ImageAnalysisRecord.
                   The old record is deleted and a fresh one is created.
  --dry-run        Print plan without calling any APIs or writing to DB.
  --skip-merge     Don't trigger merge/synthesis after analysis.
  --workers N      Concurrent Agent 1 threads (default: 8).
"""

import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import Workspace
from apps.fingerprint.models import BrandFingerprint, ImageAnalysisRecord
from apps.fingerprint.services import (
    _merge_worker,
    _synthesis_worker,
    _upload_local_file,
    _run_agent1,
)

_print_lock = threading.Lock()


class Command(BaseCommand):
    help = "Backfill fingerprint analysis for existing workspace uploads and rated generations."

    # ── Arguments ─────────────────────────────────────────────────────────────

    def add_arguments(self, parser):
        parser.add_argument(
            "workspace",
            nargs="?",
            metavar="WORKSPACE_NAME",
            help="Case-insensitive substring of the workspace name to target.",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            dest="all_workspaces",
            help="Process all workspaces.",
        )
        parser.add_argument(
            "-f", "--force",
            action="store_true",
            dest="force",
            help="Re-analyse already-analysed items (delete old record, create fresh one).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            dest="dry_run",
            help="Print plan without making any API calls or DB writes.",
        )
        parser.add_argument(
            "--skip-merge",
            action="store_true",
            dest="skip_merge",
            help="Don't trigger merge/synthesis after analysis.",
        )
        parser.add_argument(
            "--workers",
            type=int,
            default=8,
            dest="workers",
            help="Number of concurrent Agent 1 threads (default: 8).",
        )

    # ── Entry point ────────────────────────────────────────────────────────────

    def handle(self, *args, **options):
        workspace_name = options["workspace"]
        all_ws         = options["all_workspaces"]
        force          = options["force"]
        dry_run        = options["dry_run"]
        skip_merge     = options["skip_merge"]
        workers        = options["workers"]

        if not workspace_name and not all_ws:
            raise CommandError(
                "Specify a workspace name or pass --all.\n"
                "  bootstrap_fingerprint epicsweep\n"
                "  bootstrap_fingerprint --all"
            )
        if workspace_name and all_ws:
            raise CommandError("Cannot combine a workspace name with --all.")

        if all_ws:
            workspaces = list(Workspace.objects.all().order_by("name"))
            if not workspaces:
                self.stdout.write("No workspaces found.")
                return
        else:
            workspaces = list(Workspace.objects.filter(name__icontains=workspace_name))
            if not workspaces:
                raise CommandError(
                    f"No workspace matching {workspace_name!r}.\n"
                    "List all: venv/bin/python manage.py shell -c "
                    "\"from apps.accounts.models import Workspace; "
                    "[print(w.name) for w in Workspace.objects.all()]\""
                )
            if len(workspaces) > 1:
                self.stdout.write(self.style.WARNING(
                    "Multiple workspaces matched: "
                    + ", ".join(w.name for w in workspaces)
                    + "\nProcessing all of them."
                ))

        mode_tag  = "[DRY RUN] " if dry_run else ""
        force_tag = " (FORCE)"   if force   else ""
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"\n{mode_tag}bootstrap_fingerprint{force_tag} — "
            f"{len(workspaces)} workspace(s), {workers} concurrent workers\n"
        ))

        total = {"statics": 0, "skipped": 0, "errors": 0}
        for ws in workspaces:
            s = self._process_workspace(ws, force=force, dry_run=dry_run,
                                        skip_merge=skip_merge, workers=workers)
            for k in total:
                total[k] += s[k]

        self.stdout.write(self.style.SUCCESS(
            f"\n✓ Done — uploads analysed: {total['statics']}, "
            f"skipped: {total['skipped']}, "
            f"errors: {total['errors']}"
        ))

    # ── Per-workspace ──────────────────────────────────────────────────────────

    def _process_workspace(self, ws, *, force, dry_run, skip_merge, workers):
        from apps.brand_kit.models import WinningStatic

        self.stdout.write(f"\n{'─'*60}")
        self.stdout.write(self.style.MIGRATE_LABEL(f"  Workspace: {ws.name}"))
        self.stdout.write(f"{'─'*60}")

        stats = {"statics": 0, "skipped": 0, "errors": 0}

        # ── Build work lists ───────────────────────────────────────────────────

        # ALL WinningStatic uploads — ads, logos, environments, everything from brand kit.
        # GeneratedCreative records are NOT touched here at all.
        all_statics = list(WinningStatic.objects.filter(workspace=ws).order_by("id"))

        statics_todo, statics_skip = [], []
        for s in all_statics:
            exists = ImageAnalysisRecord.objects.filter(workspace=ws, winning_static_id=s.id).exists()
            if exists and not force:
                statics_skip.append(s)
            else:
                statics_todo.append(s)

        total_todo = len(statics_todo)
        total_skip = len(statics_skip)

        self.stdout.write(
            f"  Uploads (all)   : {len(all_statics):3}  →  {len(statics_todo):3} to analyse, "
            f"{len(statics_skip):3} already done"
        )

        stats["skipped"] += total_skip

        if dry_run:
            stats["statics"] += total_todo
            self.stdout.write(f"  [DRY RUN] would submit {total_todo} Agent 1 calls concurrently")
            return stats

        if total_todo == 0:
            self.stdout.write("  Nothing to do.")
        else:
            self.stdout.write(
                f"  Submitting {total_todo} Agent 1 calls "
                f"({min(workers, total_todo)} concurrent)…"
            )

        # ── Delete old records upfront if force ────────────────────────────────
        if force:
            old_static_ids = [s.id for s in statics_todo]
            if old_static_ids:
                deleted, _ = ImageAnalysisRecord.objects.filter(
                    workspace=ws, winning_static_id__in=old_static_ids
                ).delete()
                if deleted:
                    self.stdout.write(f"  [FORCE] deleted {deleted} old static records")

        # ── Concurrent Agent 1 calls ───────────────────────────────────────────
        ok = err = 0

        def analyse_static(static):
            try:
                image_url = _upload_local_file(static.file.path)
                analysis  = _run_agent1(image_url)
                if analysis is None:
                    return ("error", f"static #{static.id}: Agent 1 returned None")
                ImageAnalysisRecord.objects.create(
                    workspace         = ws,
                    image_url         = image_url,
                    source            = ImageAnalysisRecord.SOURCE_GALLERY,
                    winning_static_id = static.id,
                    rating            = None,
                    analysis          = analysis.model_dump(mode="json"),
                )
                return ("ok", f"static #{static.id} — {static.name or '(no name)'}")
            except FileNotFoundError:
                return ("warn", f"static #{static.id}: file missing on disk")
            except Exception as exc:
                return ("error", f"static #{static.id}: {exc}")

        futures = {}
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for s in statics_todo:
                futures[pool.submit(analyse_static, s)] = s

            done_count = 0
            for fut in as_completed(futures):
                status, msg = fut.result()
                done_count += 1
                prefix = f"  [{done_count:3}/{total_todo}]"

                with _print_lock:
                    if status == "ok":
                        self.stdout.write(self.style.SUCCESS(f"{prefix} ✓ {msg}"))
                        ok += 1
                    elif status == "warn":
                        self.stdout.write(self.style.WARNING(f"{prefix} ⚠ {msg}"))
                        err += 1
                    else:
                        self.stdout.write(self.style.ERROR(f"{prefix} ✗ {msg}"))
                        err += 1

        stats["statics"] += ok
        stats["errors"]  += err

        self.stdout.write(f"  Analysis done — {ok} ok / {err} errors")

        # ── Merge / Synthesis ──────────────────────────────────────────────────
        if skip_merge:
            self.stdout.write("  [skip-merge] skipping merge/synthesis")
            return stats

        corpus_count = ImageAnalysisRecord.objects.filter(workspace=ws).count()
        unmerged     = ImageAnalysisRecord.objects.filter(
            workspace=ws, included_in_fingerprint_version__isnull=True
        ).count()
        fp = BrandFingerprint.objects.filter(workspace=ws).first()

        self.stdout.write(
            f"  Corpus: {corpus_count} total  |  {unmerged} unmerged  |  "
            f"FP: {'exists' if fp else 'none'}"
        )

        if corpus_count == 0:
            self.stdout.write(self.style.WARNING("  No corpus — skipping merge/synthesis"))
            return stats

        if fp is None:
            self.stdout.write("  → Full synthesis (no existing fingerprint) — running synchronously…")
            _synthesis_worker(ws.id, reason="bootstrap")
            self.stdout.write(self.style.SUCCESS("  ✓ Synthesis complete"))
        elif force:
            self.stdout.write("  → Full synthesis (force rebuild) — running synchronously…")
            ImageAnalysisRecord.objects.filter(workspace=ws).update(
                included_in_fingerprint_version=None
            )
            _synthesis_worker(ws.id, reason="bootstrap_force")
            self.stdout.write(self.style.SUCCESS("  ✓ Synthesis complete"))
        elif unmerged > 0:
            self.stdout.write(f"  → Incremental merge ({unmerged} unmerged) — running synchronously…")
            _merge_worker(ws.id)
            self.stdout.write(self.style.SUCCESS("  ✓ Merge complete"))
        else:
            self.stdout.write("  Fingerprint is up-to-date — nothing to merge")

        return stats
