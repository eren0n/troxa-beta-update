import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { ProfileDropdown } from './ProfileDropdown';
import {
  Bell, HelpCircle, Menu, Sparkles, Zap, Play, Download,
  Users, X, ExternalLink, Keyboard, BookOpen, MessageCircle,
  ChevronRight, CheckCircle2, ArrowRight, Loader2,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { activityApi, teamApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useGeneration } from '../../contexts/GenerationContext';

const pageTitles = {
  '/dashboard': 'Overview',
  '/dashboard/activity': 'Activity',
  '/dashboard/create': 'Generate Creatives',
  '/dashboard/creatives': 'Creative Gallery',
  '/dashboard/brand-kit': 'Brand Kit',
  '/dashboard/automation': 'Pipeline Automation',
  '/dashboard/team': 'Team Workspace',
  '/dashboard/billing': 'Billing & Usage',
  '/dashboard/profile': 'My Profile',
  '/dashboard/settings': 'Settings',
};

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

// Only these event types appear in the bell dropdown — everything else goes to Activity page only
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

const SHORTCUTS = [
  { keys: ['G', 'H'], label: 'Go to Dashboard' },
  { keys: ['G', 'C'], label: 'Go to Creatives' },
  { keys: ['G', 'B'], label: 'Go to Brand Kit' },
  { keys: ['G', 'T'], label: 'Go to Team' },
  { keys: ['N'], label: 'New Generation' },
  { keys: ['?'], label: 'Open this panel' },
];

export const DashboardLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [acceptingIds, setAcceptingIds] = useState(new Set());
  const [acceptedIds, setAcceptedIds] = useState(new Set());
  const [toasts, setToasts] = useState([]);
  const notifRef = useRef(null);
  const helpRef = useRef(null);
  const seenEventIds = useRef(new Set());
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { pendingCount, allSettled, activeJobs } = useGeneration();
  const prevAllSettled = useRef(false);

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  const TOAST_TYPES = new Set(['generation', 'creative.generated']);

  const pushToast = (event) => {
    // one toast at a time — replace any existing
    const id = event.id || Math.random().toString(36).slice(2);
    setToasts([{ id, description: event.description }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  // Toast when generation finishes (driven from context, not activity polling)
  useEffect(() => {
    if (allSettled && !prevAllSettled.current && activeJobs.length > 0) {
      const count = activeJobs.filter(j => j.status === 'done').length;
      pushToast({ id: 'gen-done', description: `${count} creative${count !== 1 ? 's' : ''} ready!` });
    }
    prevAllSettled.current = allSettled;
  }, [allSettled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toast on 403 permission errors from API
  useEffect(() => {
    const handler = (e) => {
      pushToast({ id: 'forbidden', description: "You don't have permission to do that.", error: true });
    };
    window.addEventListener('api:forbidden', handler);
    return () => window.removeEventListener('api:forbidden', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load unread count on mount — seed seenEventIds so we don't toast old events
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

  // Poll every 12s for new events
  useEffect(() => {
    const interval = setInterval(async () => {
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

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (helpRef.current  && !helpRef.current.contains(e.target))  setHelpOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut: ? opens help
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '?' && !e.target.closest('input, textarea')) setHelpOpen(v => !v);
      if (e.key === 'Escape') { setHelpOpen(false); setNotifOpen(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const openNotifs = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    setHelpOpen(false);
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

  const pageTitle = pageTitles[location.pathname] || 'Dashboard';

  return (
    <div className="min-h-screen bg-[#05070a] text-white font-sans flex overflow-x-hidden">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      <motion.div
        animate={{ marginLeft: collapsed ? 72 : 260 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex-1 flex flex-col min-w-0 w-full lg:ml-0"
        style={{ marginLeft: 0 }}
      >
        {/* Top Header */}
        <header className="h-16 lg:h-20 border-b border-white/5 px-4 lg:px-8 flex items-center justify-between sticky top-0 bg-[#05070a]/90 backdrop-blur-xl z-40">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-white/5"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden lg:block min-w-0">
              <h2 className="text-sm font-black text-white uppercase tracking-wider truncate">{pageTitle}</h2>
              <p className="text-[10px] text-gray-600 font-medium">troxa.ai // workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <WorkspaceSwitcher />

            <div className="flex items-center gap-1 lg:gap-2 border-r border-white/5 pr-2 lg:pr-5">

              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={openNotifs}
                  className="p-2 text-gray-400 hover:text-white transition-colors relative rounded-xl hover:bg-white/5"
                >
                  <Bell style={{ width: 18, height: 18 }} />
                  {newCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 bg-blue-500 rounded-full border border-[#05070a] flex items-center justify-center text-[8px] font-black text-white animate-pulse">
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
                      className="absolute top-full right-0 mt-3 w-80 bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-widest text-white">Notifications</p>
                        <button onClick={() => setNotifOpen(false)} className="text-gray-600 hover:text-white transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
                        {notifsLoading ? (
                          <div className="p-6 flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="p-6 text-center">
                            <CheckCircle2 className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                            <p className="text-xs text-slate-600">All caught up!</p>
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
                                // Reload page so new workspace appears in switcher
                                window.location.reload();
                              } catch (err) {
                                alert(err.message || 'Failed to accept invite');
                              } finally {
                                setAcceptingIds(prev => { const s = new Set(prev); s.delete(inviteId); return s; });
                              }
                            };

                            return (
                              <div key={n.id || i} className="flex items-start gap-3 p-4 hover:bg-white/2 transition-colors">
                                <div className={`p-1.5 rounded-lg ${meta.color} shrink-0 mt-0.5`}>
                                  <Icon className="w-3 h-3" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-white">{meta.label}</p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">{n.description}</p>
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
                                <span className="text-[9px] text-gray-600 shrink-0">{timeAgo(n.created_at)}</span>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="p-3 border-t border-white/5 space-y-1">
                        <p className="text-center text-[9px] text-slate-700">Only important alerts shown here</p>
                        <Link
                          to="/dashboard/activity"
                          onClick={() => setNotifOpen(false)}
                          className="w-full flex items-center justify-center gap-1.5 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors py-1"
                        >
                          Full Activity Log <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Help */}
              <div className="relative hidden lg:block" ref={helpRef}>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setHelpOpen(v => !v); setNotifOpen(false); }}
                  className={`p-2 transition-colors rounded-xl hover:bg-white/5 ${helpOpen ? 'text-white bg-white/5' : 'text-gray-400 hover:text-white'}`}
                >
                  <HelpCircle style={{ width: 18, height: 18 }} />
                </motion.button>

                <AnimatePresence>
                  {helpOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute top-full right-0 mt-3 w-72 bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-widest text-white">Help & Resources</p>
                        <button onClick={() => setHelpOpen(false)} className="text-gray-600 hover:text-white transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Shortcuts */}
                      <div className="p-3 border-b border-white/5">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5 mb-2.5 px-1">
                          <Keyboard className="w-3 h-3" /> Keyboard Shortcuts
                        </p>
                        <div className="space-y-1">
                          {SHORTCUTS.map((s, i) => (
                            <div key={i} className="flex items-center justify-between px-1 py-0.5">
                              <span className="text-[10px] text-slate-500">{s.label}</span>
                              <div className="flex items-center gap-1">
                                {s.keys.map((k, ki) => (
                                  <span key={ki} className="text-[9px] font-black text-slate-400 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 font-mono">
                                    {k}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Links */}
                      <div className="p-2">
                        {[
                          { icon: BookOpen, label: 'Documentation', sub: 'Guides & API reference', href: '#' },
                          { icon: MessageCircle, label: 'Contact Support', sub: 'Get help from our team', href: 'mailto:support@troxa.ai' },
                        ].map((item, i) => (
                          <a
                            key={i}
                            href={item.href}
                            target={item.href.startsWith('http') ? '_blank' : undefined}
                            rel="noreferrer"
                            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all group"
                          >
                            <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-blue-500/10 flex items-center justify-center transition-colors shrink-0">
                              <item.icon className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white flex items-center gap-1">
                                {item.label}
                                {item.href.startsWith('http') && <ExternalLink className="w-2.5 h-2.5 text-slate-600" />}
                              </p>
                              <p className="text-[10px] text-slate-600">{item.sub}</p>
                            </div>
                          </a>
                        ))}
                      </div>

                      <div className="px-4 pb-3 pt-1">
                        <p className="text-[9px] text-slate-700 text-center">Press <kbd className="text-[9px] bg-white/5 border border-white/10 rounded px-1 font-mono">?</kbd> to toggle this panel</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <ProfileDropdown />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto overflow-x-hidden relative w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>

          {/* Compliance Footer */}
          <footer className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 opacity-30 hover:opacity-80 transition-opacity duration-500 pb-10">
            <div className="flex items-center gap-4 text-center md:text-left">
              <div className="w-8 h-8 rounded-full border border-red-500/40 flex items-center justify-center text-[10px] font-bold text-red-500 shrink-0">18+</div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Professional iGaming Tech Stack</p>
                <p className="text-[9px] text-gray-600">Compliance Verified B2B Output Engine</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-4 lg:gap-6 text-[10px] font-medium text-gray-600">
              <a href="#" className="hover:text-blue-500 transition-colors">Responsible Gaming Policy</a>
              <a href="#" className="hover:text-blue-500 transition-colors">Terms of Infrastructure</a>
              <a href="#" className="hover:text-blue-500 transition-colors">Compliance Audit Logs</a>
            </div>
          </footer>
        </main>
      </motion.div>

      {/* Generation toast — thin bar, top-right */}
      <div className="fixed top-20 right-4 z-[9999] pointer-events-none">
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
                  onClick={() => { navigate('/dashboard/creatives'); setToasts([]); }}
                  className="text-[10px] font-black uppercase tracking-widest opacity-80 hover:opacity-100 transition-opacity whitespace-nowrap ml-1"
                >
                  View →
                </button>
              )}
              <button
                onClick={() => setToasts([])}
                className="p-0.5 opacity-60 hover:opacity-100 transition-opacity ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Global generation queue chip — only shown while jobs are running */}
      <AnimatePresence>
        {pendingCount > 0 && location.pathname !== '/dashboard/create' && (
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            onClick={() => navigate('/dashboard/create')}
            className="fixed bottom-6 right-6 z-[9998] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl text-sm font-black transition-all border bg-[#10141d] border-blue-500/30 text-white hover:border-blue-500/60"
          >
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            {pendingCount} job{pendingCount > 1 ? 's' : ''} running
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
