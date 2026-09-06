import { useState, useEffect, useRef, Suspense } from 'react';
import { GLASS_STYLE } from '../ui/GlassCard';
import { Skeleton } from '../ui/Skeleton';
import { BottomDock } from './BottomDock';
import { GlassBackground } from './GlassBackground';
import { Sidebar } from './Sidebar';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { ProfileDropdown } from './ProfileDropdown';
import { Logo } from '../layout/Logo';
import ThemeSetupModal from '../ui/ThemeSetupModal';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Bell, Sparkles, Zap, Play, Download,
  Users, X, CheckCircle2, ArrowRight, Loader2, Menu,
} from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { activityApi, teamApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useGeneration } from '../../contexts/GenerationContext';

// Scoped to the content area only — shown while a tab's chunk loads, so the
// sidebar/header/background never unmount and only this region skeletons.
function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-56 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

const EVENT_META = {
  generation_started:     { label: 'Generation Started', icon: Zap,      color: 'text-blue-400 bg-blue-500/10' },
  generation:             { label: 'Creatives Ready',    icon: Sparkles, color: 'text-green-400 bg-green-500/10' },
  'creative.generated':   { label: 'Creatives Ready',    icon: Sparkles, color: 'text-green-400 bg-green-500/10' },
  'creative.exported':    { label: 'Creative Exported',  icon: Download, color: 'text-purple-400 bg-purple-500/10' },
  make_video:             { label: 'Video Generated',    icon: Play,     color: 'text-pink-400 bg-pink-500/10' },
  'team.invited':         { label: 'Team Invite',        icon: Users,    color: 'text-emerald-400 bg-emerald-500/10' },
  'team.member_joined':   { label: 'Member Joined',      icon: Users,    color: 'text-blue-400 bg-blue-500/10' },
  'team.member_removed':  { label: 'Member Removed',     icon: Users,    color: 'text-red-400 bg-red-500/10' },
  invite_sent:            { label: 'Invite Sent',        icon: Users,    color: 'text-slate-400 bg-slate-500/10' },
};

const BELL_TYPES = new Set([
  'generation',
  'creative.generated',
  'make_video',
  'team.invited',
  'team.member_joined',
  'team.member_removed',
]);

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const DashboardLayout = () => {
  const { uiDesign, colorMode } = useTheme();
  const isClassic = uiDesign === 'classic';

  // Classic sidebar state
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [acceptingIds, setAcceptingIds] = useState(new Set());
  const [acceptedIds, setAcceptedIds] = useState(new Set());
  const [toasts, setToasts] = useState([]);
  const notifRef = useRef(null);
  const seenEventIds = useRef(new Set());
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshUser, credits } = useAuth();
  const creditBalance = credits?.balance ?? null;
  const creditTotal = credits?.total ?? 0; // null (unlimited) coerces to 0 for the % math below
  const creditIsUnlimited = credits?.total === null;
  const creditPct = creditTotal > 0 ? Math.round((creditBalance / creditTotal) * 100) : 0;
  const { pendingCount, allSettled, activeJobs } = useGeneration();
  const prevAllSettled = useRef(false);

  const TOAST_TYPES = new Set(['generation', 'creative.generated']);

  const pushToast = (event) => {
    const id = event.id || Math.random().toString(36).slice(2);
    setToasts([{ id, description: event.description }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  useEffect(() => {
    if (allSettled && !prevAllSettled.current && activeJobs.length > 0) {
      const count = activeJobs.filter(j => j.status === 'done').length;
      pushToast({ id: 'gen-done', description: `${count} creative${count !== 1 ? 's' : ''} ready!` });
    }
    prevAllSettled.current = allSettled;
  }, [allSettled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () => {
      pushToast({ id: 'forbidden', description: "You don't have permission to do that.", error: true });
    };
    window.addEventListener('api:forbidden', handler);
    return () => window.removeEventListener('api:forbidden', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    activityApi.events({ limit: 50 }).then((data) => {
      const events = data?.results || data || [];
      events.forEach(e => seenEventIds.current.add(e.id));
      const bellEvents = events.filter(e => BELL_TYPES.has(e.event_type));
      const lastSeen = localStorage.getItem('notifs_last_seen');
      const count = bellEvents.filter(e => !lastSeen || new Date(e.created_at) > new Date(lastSeen)).length;
      setNewCount(Math.min(count, 9));
      setNotifications(bellEvents);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const interval = setInterval(async () => {
      // This poll runs for the entire dashboard session — skip it while
      // the tab is backgrounded so a forgotten/idle tab doesn't keep
      // hitting the activity endpoint every 12s indefinitely. It picks
      // back up as soon as the tab is visible again.
      if (document.hidden) return;
      try {
        const data = await activityApi.events({ limit: 20 });
        const events = data?.results || data || [];
        let newBell = 0;
        const freshBell = [];
        events.forEach(e => {
          if (seenEventIds.current.has(e.id)) return;
          seenEventIds.current.add(e.id);
          if (TOAST_TYPES.has(e.event_type)) pushToast(e);
          if (BELL_TYPES.has(e.event_type)) {
            newBell++;
            freshBell.push(e);
          }
        });
        if (newBell > 0) {
          setNewCount(c => Math.min(c + newBell, 9));
          setNotifications(prev => [...freshBell, ...prev].slice(0, 20));
        }
      } catch (_) {}
    }, 12000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const openNotifs = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) {
      localStorage.setItem('notifs_last_seen', new Date().toISOString());
      setNewCount(0);
      if (notifications.length === 0) {
        setNotifsLoading(true);
        try {
          const data = await activityApi.events({ limit: 50 });
          const events = (data?.results || data || []).filter(e => BELL_TYPES.has(e.event_type));
          setNotifications(events);
        } catch (_) {} finally {
          setNotifsLoading(false);
        }
      }
    }
  };

  // Dynamic left margin for classic sidebar
  const sidebarWidth = collapsed ? 72 : 260;

  return (
    <div
      className="min-h-screen font-sans flex overflow-x-hidden relative"
      data-color-mode={colorMode}
      data-ui-design={uiDesign}
      style={{ color: 'var(--text-primary)', background: 'var(--bg-page)' }}
    >

      {/* First-visit theme setup modal */}
      <ThemeSetupModal />

      {/* Rework: animated WebGL background */}
      {!isClassic && <GlassBackground />}

      {/* Rework: floating bottom dock */}
      {!isClassic && <BottomDock />}

      {/* Classic: fixed left sidebar */}
      {isClassic && (
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />
      )}

      {/* Main content wrapper — offset for classic sidebar */}
      <motion.div
        className="flex-1 flex flex-col min-w-0 w-full relative z-10"
        animate={isClassic ? { marginLeft: sidebarWidth } : { marginLeft: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Top Header */}
        <header
          className="h-16 lg:h-20 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-40"
          style={{ ...GLASS_STYLE, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
        >
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Mobile hamburger — only in classic design */}
            {isClassic && (
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 rounded-xl transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <Menu style={{ width: 20, height: 20 }} />
              </button>
            )}

            {/* Logo/wordmark — classic layout already shows this in the
                sidebar, so it only appears here for the rework layout
                (which has no sidebar). Not a Link (no anchor semantics),
                just a programmatic navigate() so it fits in with the
                buttons around it; the route change still gets the same
                smooth crossfade the rest of the dashboard's tab switches
                get. */}
            {!isClassic && (
              <motion.button
                onClick={() => navigate('/dashboard')}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2.5 group shrink-0 cursor-pointer"
              >
                <Logo className="w-7 h-7 lg:w-8 lg:h-8 group-hover:drop-shadow-accent transition-all" />
                <span className="hidden sm:inline text-xl lg:text-2xl font-black tracking-tight leading-none" style={{ color: 'var(--text-primary)' }}>
                  Troxa.ai
                </span>
              </motion.button>
            )}
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            {/* Rework keeps the switcher first; classic pushes it to the
                far right instead (see the other copy at the end of this
                cluster). */}
            {!isClassic && <WorkspaceSwitcher />}

            {/* Minimal credits indicator — the rework bottom-dock nav has no
                room for the sidebar's full credits card, so it lives here
                instead, visible in both classic and rework layouts. */}
            {creditBalance !== null && (
              <Link
                to="/dashboard/workspace?tab=billing"
                className="hidden sm:flex flex-col justify-center gap-1 px-3 py-1.5 rounded-xl border transition-colors hover:bg-white/5 shrink-0 min-w-27"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="text-xs font-black whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                    {creditIsUnlimited ? '∞ credits' : `${creditBalance.toLocaleString()} / ${creditTotal.toLocaleString()}`}
                  </span>
                </div>
                {!creditIsUnlimited && (
                  <div className="hidden lg:block w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                    <div
                      className={`h-full rounded-full ${creditPct < 20 ? 'bg-red-500' : ''}`}
                      style={{
                        width: `${creditPct}%`,
                        ...(creditPct < 20 ? {} : { background: 'linear-gradient(to right, var(--accent-hover), var(--accent))' }),
                      }}
                    />
                  </div>
                )}
              </Link>
            )}

            <div className="flex items-center gap-1 lg:gap-2 border-r pr-2 lg:pr-5" style={{ borderColor: 'var(--border-subtle)' }}>

              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={openNotifs}
                  className="p-2 transition-colors relative rounded-xl hover:bg-white/5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Bell style={{ width: 18, height: 18 }} />
                  {newCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-3.5 h-3.5 px-0.5 bg-blue-500 rounded-full border flex items-center justify-center text-[8px] font-black text-white animate-pulse" style={{ borderColor: 'var(--bg-base)' }}>
                      {newCount}
                    </span>
                  )}
                </motion.button>

                <AnimatePresence>
                  {notifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute top-full right-0 mt-3 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden"
                      style={{ background: 'var(--dropdown-bg)', backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)', border: '1px solid var(--border-default)' }}
                    >
                      <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>Notifications</p>
                        <button onClick={() => setNotifOpen(false)} style={{ color: 'var(--text-faint)' }} className="hover:text-white transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="max-h-72 overflow-y-auto" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {notifsLoading ? (
                          <div className="p-6 flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-t-blue-500 rounded-full animate-spin" style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--accent)' }} />
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="p-6 text-center">
                            <CheckCircle2 className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--text-faint)' }} />
                            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>All caught up!</p>
                          </div>
                        ) : (
                          notifications.map((n, i) => {
                            const meta = EVENT_META[n.event_type] || { label: n.event_type, icon: Bell, color: 'text-slate-400 bg-slate-500/10' };
                            const Icon = meta.icon;
                            const inviteId = n.metadata?.invite_id;
                            const isInvite = n.event_type === 'team.invited' && inviteId;
                            const isAccepted = acceptedIds.has(inviteId);
                            const isAccepting = acceptingIds.has(inviteId);

                            const handleAccept = async () => {
                              setAcceptingIds(prev => new Set(prev).add(inviteId));
                              try {
                                await teamApi.acceptInvite(inviteId);
                                setAcceptedIds(prev => new Set(prev).add(inviteId));
                                await refreshUser();
                                window.location.reload();
                              } catch (err) {
                                alert(err.message || 'Failed to accept invite');
                              } finally {
                                setAcceptingIds(prev => { const s = new Set(prev); s.delete(inviteId); return s; });
                              }
                            };

                            return (
                              <div key={n.id || i} className="flex items-start gap-3 p-4 hover:bg-white/2 transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <div className={`p-1.5 rounded-lg ${meta.color} shrink-0 mt-0.5`}>
                                  <Icon className="w-3 h-3" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{meta.label}</p>
                                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{n.description}</p>
                                  {isInvite && !isAccepted && (
                                    <button
                                      onClick={handleAccept}
                                      disabled={isAccepting}
                                      className="mt-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/50 text-white text-[10px] font-black rounded-lg transition-all flex items-center gap-1"
                                    >
                                      {isAccepting
                                        ? <><div className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" /> Joining...</>
                                        : <><CheckCircle2 className="w-2.5 h-2.5" /> Accept Invite</>}
                                    </button>
                                  )}
                                  {isInvite && isAccepted && (
                                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> Joined!
                                    </span>
                                  )}
                                </div>
                                <span className="text-[9px] shrink-0" style={{ color: 'var(--text-faint)' }}>{timeAgo(n.created_at)}</span>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="p-3">
                        <p className="text-center text-[9px]" style={{ color: 'var(--text-faint)' }}>Only important alerts shown here</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Classic layout: profile now lives at the bottom of the sidebar instead. */}
            {!isClassic && <ProfileDropdown />}
            {isClassic && <WorkspaceSwitcher />}
          </div>
        </header>

        {/* Page Content */}
        <main className={`flex-1 p-4 lg:p-8 overflow-y-auto overflow-x-hidden relative w-full ${isClassic ? 'pb-12 lg:pb-16' : 'pb-28 lg:pb-32'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } }}
              exit={{    opacity: 0, x: -10, transition: { duration: 0.15, ease: [0.55, 0, 1, 0.45] } }}
            >
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </motion.div>

      {/* Generation toast */}
      <div className="fixed top-20 right-4 z-9999 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 60 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className={`pointer-events-auto flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-xl shadow-lg text-white ${toast.error ? 'bg-red-500 shadow-red-900/40' : 'bg-green-500 shadow-green-900/40'}`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs font-black whitespace-nowrap">{toast.description}</span>
              {!toast.error && (
                <button
                  onClick={() => { navigate('/dashboard/gallery'); setToasts([]); }}
                  className="text-[10px] font-black uppercase tracking-widest opacity-80 hover:opacity-100 transition-opacity whitespace-nowrap ml-1"
                >
                  View →
                </button>
              )}
              <button onClick={() => setToasts([])} className="p-0.5 opacity-60 hover:opacity-100 transition-opacity ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Running jobs chip */}
      <AnimatePresence>
        {pendingCount > 0 && location.pathname !== '/dashboard/create' && (
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            onClick={() => navigate('/dashboard/create')}
            className="fixed right-6 z-9998 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl text-sm font-black transition-all"
            style={{
              bottom: isClassic ? 24 : 96,
              background: 'var(--dropdown-bg)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--accent-muted)',
              color: 'var(--text-primary)',
            }}
          >
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            {pendingCount} job{pendingCount > 1 ? 's' : ''} running
            <ArrowRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
