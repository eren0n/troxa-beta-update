import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarClock, Hand, Clock, Globe, ChevronDown, Check, CalendarCheck } from 'lucide-react';
import { GLASS_STYLE } from '../ui/GlassCard';
import { getPortalRoot } from '../../lib/portalRoot';

// "When should this pipeline run?" — trigger, days, time and timezone for
// the Automation pipeline builder, plus a live "next run" line so the
// schedule reads as a sentence instead of a row of controls.
//
// Days are 0 = Monday … 6 = Sunday, matching the backend.

export const TIMEZONES = [
  { label: 'Istanbul',    abbr: 'TRT', value: 'Europe/Istanbul' },
  { label: 'New York',    abbr: 'ET',  value: 'America/New_York' },
  { label: 'Chicago',     abbr: 'CT',  value: 'America/Chicago' },
  { label: 'Denver',      abbr: 'MT',  value: 'America/Denver' },
  { label: 'Los Angeles', abbr: 'PT',  value: 'America/Los_Angeles' },
  { label: 'Anchorage',   abbr: 'AKT', value: 'America/Anchorage' },
  { label: 'Honolulu',    abbr: 'HST', value: 'Pacific/Honolulu' },
];

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_PRESETS = [
  { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Weekdays',  days: [0, 1, 2, 3, 4] },
  { label: 'Weekends',  days: [5, 6] },
];
const TIME_PRESETS = [
  { label: 'Morning', value: '09:00' },
  { label: 'Noon',    value: '12:00' },
  { label: 'Evening', value: '18:00' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

const LABEL = 'text-[10px] font-black uppercase tracking-widest text-(--text-muted)';
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// ── Time maths ───────────────────────────────────────────────────────────

// Weekday (0 = Mon) and minutes-since-midnight right now in `tz`.
function nowIn(tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    day: DAY_SHORT.indexOf(get('weekday')),
    minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')),
    label: `${get('hour')}:${get('minute')}`,
  };
}

function nextRun(days, time, tz) {
  if (!days.length || !time) return null;
  const [h, m] = time.split(':').map(Number);
  const at = h * 60 + m;
  const now = nowIn(tz);
  for (let off = 0; off <= 7; off++) {
    const d = (now.day + off) % 7;
    if (!days.includes(d) || (off === 0 && at <= now.minutes)) continue;
    const mins = off * 1440 + at - now.minutes;
    const when = off === 0 ? 'Today' : off === 1 ? 'Tomorrow' : DAY_FULL[d];
    const inLabel = mins < 60 ? `in ${mins}m`
      : mins < 1440 ? `in ${Math.floor(mins / 60)}h ${mins % 60}m`
      : `in ${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
    return { when, inLabel };
  }
  return null;
}

function daysPhrase(days) {
  const preset = DAY_PRESETS.find((p) => sameSet(p.days, days));
  if (preset) return preset.label.toLowerCase();
  return [...days].sort((a, b) => a - b).map((d) => DAY_SHORT[d]).join(', ');
}

// ── Popover ──────────────────────────────────────────────────────────────
// Portaled to the theme root with fixed positioning, repositioned on any
// scroll (the builder is its own scrolling overlay) and resize.

function Popover({ anchorRef, open, onClose, width, children }) {
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      const below = r.bottom + 8;
      // Flip above when there isn't room underneath.
      const top = below + 340 > window.innerHeight && r.top > 360 ? null : below;
      setPos(top == null ? { left, bottom: window.innerHeight - r.top + 8 } : { left, top });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <>
          <div className="fixed inset-0 z-9998" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-9999 rounded-2xl border border-(--border-default) p-2"
            style={{
              ...pos, width,
              background: 'var(--dropdown-bg)',
              backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
              boxShadow: '0 20px 50px var(--shadow-far), 0 4px 14px var(--shadow-close)',
            }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    getPortalRoot()
  );
}

// ── Time picker ──────────────────────────────────────────────────────────

function TimeColumn({ items, value, onPick, label }) {
  const listRef = useRef(null);
  // Keep the selected value in view when the popover opens or it changes.
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-selected="true"]');
    el?.scrollIntoView({ block: 'center' });
  }, [value]);
  return (
    <div className="flex-1 min-w-0">
      <p className={`${LABEL} text-center mb-1.5`}>{label}</p>
      <div ref={listRef} className="h-48 overflow-y-auto overscroll-contain space-y-0.5 pr-0.5 [scrollbar-width:thin]">
        {items.map((it) => {
          const sel = it === value;
          return (
            <button key={it} type="button" data-selected={sel} onClick={() => onPick(it)}
              className={`w-full py-1.5 rounded-lg text-sm font-bold tabular-nums transition-colors ${
                sel ? 'bg-(--accent) text-white' : 'text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)'
              }`}>
              {it}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TimePicker({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [hh, mm] = (value || '08:00').split(':');
  // An off-grid minute (e.g. an old pipeline saved at 08:07) stays pickable.
  const minutes = MINUTES.includes(mm) ? MINUTES : [...MINUTES, mm].sort();

  return (
    <>
      <button ref={ref} type="button" disabled={disabled} onClick={() => setOpen((v) => !v)}
        className={`group w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all disabled:opacity-40 ${
          open ? 'border-(--accent) bg-(--accent-muted)' : 'border-(--border-default) bg-(--bg-hover) hover:border-(--border-strong)'
        }`}>
        <Clock className="w-4 h-4 text-(--accent) shrink-0" />
        <span className="text-2xl font-black tabular-nums text-(--text-primary) tracking-tight">{hh}<span className="opacity-40 mx-0.5">:</span>{mm}</span>
        <ChevronDown className={`w-4 h-4 ml-auto text-(--text-muted) transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={232}>
        <div className="flex gap-2 p-1">
          <TimeColumn label="Hour" items={HOURS} value={hh} onPick={(h) => onChange(`${h}:${mm}`)} />
          <div className="w-px bg-(--border-subtle) my-6" />
          <TimeColumn label="Min" items={minutes} value={mm} onPick={(m) => onChange(`${hh}:${m}`)} />
        </div>
        <div className="flex gap-1 p-1 pt-2 mt-1 border-t border-(--border-subtle)">
          {TIME_PRESETS.map((p) => (
            <button key={p.value} type="button" onClick={() => { onChange(p.value); setOpen(false); }}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                value === p.value ? 'text-(--accent) bg-(--accent-muted)' : 'text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover)'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

// ── Timezone select ──────────────────────────────────────────────────────

export function TimezoneSelect({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = TIMEZONES.find((t) => t.value === value) || { label: value, abbr: '', value };

  return (
    <>
      <button ref={ref} type="button" disabled={disabled} onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all disabled:opacity-40 ${
          open ? 'border-(--accent) bg-(--accent-muted)' : 'border-(--border-default) bg-(--bg-hover) hover:border-(--border-strong)'
        }`}>
        <Globe className="w-3.5 h-3.5 text-(--text-muted) shrink-0" />
        <span className="text-xs font-bold text-(--text-primary) truncate">{current.label}</span>
        {current.abbr && <span className="text-[10px] font-black text-(--text-muted)">{current.abbr}</span>}
        <ChevronDown className={`w-3.5 h-3.5 ml-auto text-(--text-muted) transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={260}>
        <div className="space-y-0.5 max-h-72 overflow-y-auto">
          {TIMEZONES.map((tz) => {
            const sel = tz.value === value;
            return (
              <button key={tz.value} type="button" onClick={() => { onChange(tz.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${sel ? 'bg-(--accent-muted)' : 'hover:bg-(--bg-hover)'}`}>
                <span className={`text-xs font-bold flex-1 truncate ${sel ? 'text-(--accent)' : 'text-(--text-primary)'}`}>
                  {tz.label} <span className="text-(--text-muted) font-black text-[10px] ml-0.5">{tz.abbr}</span>
                </span>
                <span className="text-[11px] font-bold tabular-nums text-(--text-muted)">{nowIn(tz.value).label}</span>
                {sel && <Check className="w-3.5 h-3.5 text-(--accent) shrink-0" />}
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}

// ── Schedule editor ──────────────────────────────────────────────────────

function TriggerOption({ active, icon: Icon, title, desc, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`relative w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
        active ? 'border-(--accent) bg-(--accent-muted)' : 'border-(--border-default) hover:border-(--border-strong) hover:bg-(--bg-hover)'
      }`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
        active ? 'bg-(--accent) text-white' : 'bg-(--bg-hover) text-(--text-muted)'
      }`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-(--text-primary)">{title}</p>
        <p className="text-[11px] text-(--text-muted) mt-0.5 leading-snug">{desc}</p>
      </div>
      <span className={`mt-1 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
        active ? 'border-(--accent)' : 'border-(--border-strong)'
      }`}>
        {active && <span className="w-2 h-2 rounded-full bg-(--accent)" />}
      </span>
    </button>
  );
}

export default function ScheduleEditor({ trigger, onTriggerChange, days, onDaysChange, time, onTimeChange, timezone, onTimezoneChange }) {
  const scheduled = trigger === 'scheduled';
  // Re-render each minute so "next run in …" stays true while the page is open.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // A scheduled pipeline needs at least one day — the last one can't be cleared.
  const toggleDay = (d) => {
    if (days.includes(d)) { if (days.length > 1) onDaysChange(days.filter((x) => x !== d)); }
    else onDaysChange([...days, d]);
  };

  const tz = TIMEZONES.find((t) => t.value === timezone);
  const next = scheduled ? nextRun(days, time, timezone) : null;

  return (
    <div style={GLASS_STYLE} className="rounded-2xl overflow-hidden">
      <div className="px-5 pt-5 pb-1 flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-(--accent)" />
        <h2 className="text-sm font-black text-(--text-primary)">When should it run?</h2>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,15rem)] gap-6 items-start">
        {/* Trigger */}
        <div className="space-y-2">
          <p className={LABEL}>Trigger</p>
          <TriggerOption active={scheduled} icon={CalendarClock} title="On a schedule"
            desc="Runs by itself on the days and time you pick." onClick={() => onTriggerChange('scheduled')} />
          <TriggerOption active={!scheduled} icon={Hand} title="Manually"
            desc="Only runs when you hit Run on the pipeline list." onClick={() => onTriggerChange('manual')} />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {scheduled ? (
            <motion.div key="sched" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }} className="lg:col-span-2 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] gap-6">
              {/* Days */}
              <div className="min-w-0">
                <p className={`${LABEL} mb-2`}>Repeat on</p>
                <div className="flex gap-1.5 sm:gap-2">
                  {DAY_SHORT.map((d, i) => {
                    const on = days.includes(i);
                    return (
                      <motion.button key={d} type="button" onClick={() => toggleDay(i)} whileTap={{ scale: 0.92 }}
                        className={`flex-1 min-w-0 h-12 sm:h-16 rounded-2xl flex flex-col items-center justify-center border transition-colors ${
                          on ? 'bg-(--accent) border-(--accent) text-white shadow-lg shadow-accent-glow'
                             : 'border-(--border-default) text-(--text-muted) hover:text-(--text-primary) hover:border-(--border-strong)'
                        } ${i >= 5 && !on ? 'bg-(--bg-hover)' : ''}`}>
                        <span className="text-[11px] font-black sm:hidden">{d.slice(0, 2)}</span>
                        <span className="text-xs font-black hidden sm:inline">{d}</span>
                        <span className={`w-1 h-1 rounded-full mt-1 ${on ? 'bg-white' : 'bg-transparent'}`} />
                      </motion.button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {DAY_PRESETS.map((p) => {
                    const on = sameSet(p.days, days);
                    return (
                      <button key={p.label} type="button" onClick={() => onDaysChange(p.days)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                          on ? 'border-(--accent) text-(--accent) bg-(--accent-muted)'
                             : 'border-(--border-default) text-(--text-muted) hover:text-(--text-primary) hover:border-(--border-strong)'
                        }`}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time + timezone */}
              <div className="space-y-2">
                <p className={LABEL}>At</p>
                <TimePicker value={time} onChange={onTimeChange} />
                <TimezoneSelect value={timezone} onChange={onTimezoneChange} />
              </div>
            </motion.div>
          ) : (
            <motion.div key="manual" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="lg:col-span-2 rounded-xl border border-dashed border-(--border-default) flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-xl bg-(--bg-hover) flex items-center justify-center shrink-0">
                <Hand className="w-5 h-5 text-(--text-muted)" />
              </div>
              <div>
                <p className="text-sm font-bold text-(--text-primary)">No timetable</p>
                <p className="text-xs text-(--text-muted) mt-0.5">
                  This pipeline keeps its settings and waits. Run it from the Automation list whenever you need a fresh batch.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Schedule as a sentence */}
      <div className="px-5 py-3 border-t border-(--border-subtle) bg-(--bg-hover) flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-start gap-2 text-xs text-(--text-secondary)">
          <CalendarCheck className="w-3.5 h-3.5 mt-px text-(--accent) shrink-0" />
          <span>
            {scheduled
              ? <>Runs <b className="text-(--text-primary)">{daysPhrase(days)}</b> at <b className="text-(--text-primary) tabular-nums">{time}</b> {tz ? `${tz.label} time` : timezone}</>
              : <>Runs only when started by hand</>}
          </span>
        </span>
        {next && (
          <span className="text-xs text-(--text-muted)">
            Next run: <b className="text-(--text-primary)">{next.when}, {time}</b> · {next.inLabel}
          </span>
        )}
      </div>
    </div>
  );
}
