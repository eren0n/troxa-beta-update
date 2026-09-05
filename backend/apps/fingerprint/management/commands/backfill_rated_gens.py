"""
Management command: backfill_rated_gens
========================================

Backfills Agent 1 analysis for GeneratedCreative records that have a user
rating but no ImageAnalysisRecord yet, then triggers merge/synthesis.

Usage
-----
  # All workspaces
  python manage.py backfill_rated_gens --all

  # Single workspace
  python manage.py backfill_rated_gens epicsweep

  # Force re-analyse already-done records
  python manage.py backfill_rated_gens epicsweep -f
  python manage.py backfill_rated_gens --all -f

  # Preview without touching anything
  python manage.py backfill_rated_gens --all --dry-run

Flags
-----
  --all            Process every workspace.
  -f / --force     Delete existing records and re-analyse.
  --dry-run        Print plan only, no API calls or DB writes.
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
    _run_agent1,
)

_print_lock = threading.Lock()


class Command(BaseCommand):
    help = "Backfill fingerprint analysis for rated GeneratedCreative records."

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
        )
        parser.add_argument(
            "-f", "--force",
            action="store_true",
            dest="force",
            help="Re-analyse already-analysed records (delete old, create fresh).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            dest="dry_run",
        )
        parser.add_argument(
            "--skip-merge",
            action="store_true",
            dest="skip_merge",
        )
        parser.add_argument(
            "--workers",
            type=int,
            default=8,
            dest="workers",
        )

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
                "  backfill_rated_gens epicsweep\n"
                "  backfill_rated_gens --all"
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
                raise CommandError(f"No workspace matching {workspace_name!r}.")
            if len(workspaces) > 1:
                self.stdout.write(self.style.WARNING(
                    "Multiple workspaces matched: "
                    + ", ".join(w.name for w in workspaces)
                    + "\nProcessing all of them."
                ))

        mode_tag  = "[DRY RUN] " if dry_run else ""
        force_tag = " (FORCE)"   if force   else ""
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"\n{mode_tag}backfill_rated_gens{force_tag} — "
            f"{len(workspaces)} workspace(s), {workers} concurrent workers\n"
        ))

        total = {"gens": 0, "skipped": 0, "errors": 0}
        for ws in workspaces:
            s = self._process_workspace(ws, force=force, dry_run=dry_run,
                                        skip_merge=skip_merge, workers=workers)
            for k in total:
                total[k] += s[k]

        self.stdout.write(self.style.SUCCESS(
            f"\n✓ Done — rated gens analysed: {total['gens']}, "
            f"skipped: {total['skipped']}, "
            f"errors: {total['errors']}"
        ))

    def _process_workspace(self, ws, *, force, dry_run, skip_merge, workers):
        from apps.creatives.models import GeneratedCreative

        self.stdout.write(f"\n{'─'*60}")
        self.stdout.write(self.style.MIGRATE_LABEL(f"  Workspace: {ws.name}"))
        self.stdout.write(f"{'─'*60}")

        stats = {"gens": 0, "skipped": 0, "errors": 0}

        all_rated = list(
            GeneratedCreative.objects
            .filter(workspace=ws, rating__isnull=False)
            .exclude(image_url="")
            .order_by("id")
        )

        todo, skip = [], []
        for g in all_rated:
            exists = ImageAnalysisRecord.objects.filter(workspace=ws, creative_id=g.id).exists()
            if exists and not force:
                skip.append(g)
            else:
                todo.append(g)

        self.stdout.write(
            f"  Rated creatives : {len(all_rated):3}  →  "
            f"{len(todo):3} to analyse, {len(skip):3} already done"
        )
        stats["skipped"] += len(skip)

        if dry_run:
            stats["gens"] += len(todo)
            self.stdout.write(f"  [DRY RUN] would submit {len(todo)} Agent 1 calls concurrently")
            return stats

        if not todo:
            self.stdout.write("  Nothing to do.")
        else:
            self.stdout.write(
                f"  Submitting {len(todo)} Agent 1 calls "
                f"({min(workers, len(todo))} concurrent)…"
            )

        # Delete old records upfront if force
        if force and todo:
            deleted, _ = ImageAnalysisRecord.objects.filter(
                workspace=ws, creative_id__in=[g.id for g in todo]
            ).delete()
            if deleted:
                self.stdout.write(f"  [FORCE] deleted {deleted} old records")

        ok = err = 0

        def analyse(creative):
            try:
                analysis = _run_agent1(creative.image_url)
                if analysis is None:
                    return ("error", f"creative #{creative.id}: Agent 1 returned None")
                ImageAnalysisRecord.objects.create(
                    workspace   = ws,
                    image_url   = creative.image_url,
                    source      = ImageAnalysisRecord.SOURCE_GENERATION,
                    creative_id = creative.id,
                    rating      = creative.rating,
                    analysis    = analysis.model_dump(mode="json"),
                )
                return ("ok", f"creative #{creative.id} (rating={creative.rating})")
            except Exception as exc:
                return ("error", f"creative #{creative.id}: {exc}")

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(analyse, g): g for g in todo}
            done_count = 0
            for fut in as_completed(futures):
                status, msg = fut.result()
                done_count += 1
                prefix = f"  [{done_count:3}/{len(todo)}]"
                with _print_lock:
                    if status == "ok":
                        self.stdout.write(self.style.SUCCESS(f"{prefix} ✓ {msg}"))
                        ok += 1
                    else:
                        self.stdout.write(self.style.ERROR(f"{prefix} ✗ {msg}"))
                        err += 1

        stats["gens"]   += ok
        stats["errors"] += err
        self.stdout.write(f"  Analysis done — {ok} ok / {err} errors")

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
            _synthesis_worker(ws.id, reason="backfill_rated")
            self.stdout.write(self.style.SUCCESS("  ✓ Synthesis complete"))
        elif force:
            self.stdout.write("  → Full synthesis (force rebuild) — running synchronously…")
            ImageAnalysisRecord.objects.filter(workspace=ws).update(
                included_in_fingerprint_version=None
            )
            _synthesis_worker(ws.id, reason="backfill_rated_force")
            self.stdout.write(self.style.SUCCESS("  ✓ Synthesis complete"))
        elif unmerged > 0:
            self.stdout.write(f"  → Incremental merge ({unmerged} unmerged) — running synchronously…")
            _merge_worker(ws.id)
            self.stdout.write(self.style.SUCCESS("  ✓ Merge complete"))
        else:
            self.stdout.write("  Fingerprint is up-to-date — nothing to merge")

        return stats
