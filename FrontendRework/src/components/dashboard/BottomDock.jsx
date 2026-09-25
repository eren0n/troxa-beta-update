import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home, SquarePlus, Image, Palette,
  Cpu, Building2, Shield, Lock, ChevronDown, Video, Pencil, Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { preloadDashboardRoute } from '../../lib/dashboardRoutes';
import { mgmtApi } from '../../lib/api';
import { getPortalRoot } from '../../lib/portalRoot';

const STORAGE_KEY = 'dock_pinned';

const NAV_GROUPS = [
  {
    items: [
      { name: 'Home', icon: Home, path: '/dashboard' },
    ],
  },
  {
    items: [
      { name: 'Generate',   icon: SquarePlus, path: '/dashboard/create' },
      { name: 'Prompt Studio', icon: Sparkles, path: '/dashboard/prompt-studio' },
      { name: 'Make Video', icon: Video,      path: '/dashboard/make-video' },
      { name: 'Edit',       icon: Pencil,     path: '/dashboard/editor' },
      { name: 'Gallery',    icon: Image,      path: '/dashboard/gallery' },
      { name: 'Brand Kit',  icon: Palette,    path: '/dashboard/brand-kit' },
      { name: 'Automation', icon: Cpu,        path: '/dashboard/automation' },
    ],
  },
  {
    items: [
      // Team, Billing & Integrations merged into one page — Profile and
      // Settings live one click away via the profile dropdown instead.
      { name: 'Workspace', icon: Building2, path: '/dashboard/workspace' },
    ],
  },
];

const RMGS_ADMINS       = new Set(['eren@rmgs.online', 'kaan@rmgs.online', 'tolga@rmgs.online']);
const FREE_LOCKED       = new Set(['/dashboard/brand-kit', '/dashboard/automation']);
const INDIVIDUAL_LOCKED = new Set(['/dashboard/automation']);

const DOCK_STYLE = {
  background:           'var(--glass-bg)',
  backdropFilter:       'var(--glass-filter)',
  WebkitBackdropFilter: 'var(--glass-filter)',
  borderRadius:          28,
  border:               '1px solid var(--border-subtle)',
  boxShadow: [
    '0 24px 64px var(--shadow-far)',
    '0 6px 20px var(--shadow-close)',
    'inset 0 1px 0 var(--glass-rim)',
    'inset 0 -1px 0 var(--shadow-close)',
  ].join(', '),
};

const TOOLTIP_STYLE = {
  background:           'var(--dropdown-bg)',
  backdropFilter:       'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border:               '1px solid var(--border-subtle)',
  boxShadow:            '0 6px 20px var(--shadow-far)',
  borderRadius:          12,
};

// The dock scrolls horizontally on narrow screens (overflow-x-auto), and that
// clips anything drawn above it — so tooltips are portaled out and pinned to
// the hovered button's rect instead of living inside the nav.
function DockTooltip({ anchor, children }) {
  return createPortal(
    <AnimatePresence>
      {anchor && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.85 }}
          transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
          className="fixed pointer-events-none z-9999"
          style={{ left: anchor.x, bottom: anchor.bottom, x: '-50%' }}
        >
          <div style={TOOLTIP_STYLE}>{children}</div>
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-1 overflow-hidden">
            <div
              className="w-2 h-2 rotate-45 -translate-y-1/2"
              style={{ background: 'var(--dropdown-bg)', border: '1px solid var(--border-subtle)' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    getPortalRoot()
  );
}

const anchorFrom = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, bottom: window.innerHeight - r.top + 12 };
};

export const BottomDock = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isFreeTier, isIndividualTier, isDataUser, user } = useAuth();
  const isAdmin = RMGS_ADMINS.has(user?.email);
  const [hasMgmtAccess, setHasMgmtAccess] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchPerms = () => {
      mgmtApi.myPermissions()
        .then(p => setHasMgmtAccess(p.tabs.length > 0 || p.is_upper_management))
        .catch(() => {});
    };
    fetchPerms();
    const onVisible = () => { if (document.visibilityState === 'visible') fetchPerms(); };
    window.addEventListener('focus', fetchPerms);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', fetchPerms);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.email]);

  // pinned = always visible · false = auto-hide (hover to show)
  const [pinned, setPinned] = useState(() => localStorage.getItem(STORAGE_KEY) !== '0');
  const [hoverVisible, setHoverVisible] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [btnHovered, setBtnHovered] = useState(false);
  // { x, bottom } viewport coords of the hovered button, for DockTooltip
  const [tipAnchor, setTipAnchor] = useState(null);
  const [btnAnchor, setBtnAnchor] = useState(null);

  // Auto-hide is a hover gesture — there's no hover on a touchscreen, so a
  // device with no fine pointer always behaves as pinned (and doesn't get
  // the pin/auto-hide toggle, which would otherwise do nothing visible).
  const [isTouch] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(hover: none), (pointer: coarse)').matches
  );
  const effectivePinned = pinned || isTouch;

  const isVisible = effectivePinned || hoverVisible;

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  };

  const adminItems = [
    ...((isAdmin || hasMgmtAccess) ? [{ name: 'RMGS Mgmt', icon: Shield, path: '/dashboard/mgmt', isAdmin: true }] : []),
    // Manage Data hidden
  ];
  const groups = [
    ...(adminItems.length ? [{ items: adminItems }] : []),
    ...NAV_GROUPS,
  ];

  return (
    /*
      Outer zone:
      - When pinned: pointer-events-none (dock handles its own clicks), height auto
      - When auto-hide: pointer-events-auto + fixed height = hover trigger zone
    */
    <div
      className="fixed bottom-0 inset-x-0 flex justify-center items-end px-3 z-50"
      style={{
        height:        effectivePinned ? 'auto' : 80,
        pointerEvents: effectivePinned ? 'none' : 'auto',
        // 1.25rem base gap plus the iOS home-indicator safe area, so the dock
        // never sits under it on a notched phone.
        paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))',
      }}
      onMouseEnter={() => !effectivePinned && setHoverVisible(true)}
      onMouseLeave={() => !effectivePinned && setHoverVisible(false)}
    >
      {/* Hint bar — visible when auto-hide and not hovering */}
      <AnimatePresence>
        {!effectivePinned && !hoverVisible && (
          <motion.div
            key="hint"
            initial={{ opacity: 0, scaleX: 0.4 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleX: 0.4 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 h-1 w-[50vw] min-w-36 max-w-lg rounded-full pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--border-strong), transparent)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Tooltips (portaled — see DockTooltip) */}
      {(() => {
        const item = isVisible && hovered ? groups.flatMap(g => g.items).find(i => i.path === hovered) : null;
        const locked = item && !item.isAdmin && (
          (isFreeTier       && FREE_LOCKED.has(item.path)) ||
          (isIndividualTier && INDIVIDUAL_LOCKED.has(item.path))
        );
        return (
          <DockTooltip anchor={item ? tipAnchor : null}>
            {item && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-white whitespace-nowrap">
                {item.name}
                {locked && <Lock className="w-2.5 h-2.5 text-slate-500 shrink-0" />}
              </div>
            )}
          </DockTooltip>
        );
      })()}
      {!isTouch && (
        <DockTooltip anchor={isVisible && btnHovered ? btnAnchor : null}>
          <div className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 whitespace-nowrap">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: pinned ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: pinned ? 'var(--accent)' : 'var(--text-faint)',
                  boxShadow:  pinned ? '0 0 6px var(--accent)' : 'none',
                }}
              />
              {pinned ? 'Pinned' : 'Auto-hide'}
            </span>
            <span className="text-[10px] text-gray-600">
              {pinned ? 'Click to auto-hide' : 'Click to pin'}
            </span>
          </div>
        </DockTooltip>
      )}

      {/* Inner wrapper restores pointer events */}
      <div style={{ pointerEvents: 'auto' }}>
        <AnimatePresence>
          {isVisible && (
            <motion.nav
              key="dock"
              aria-label="Main navigation"
              initial={{ y: effectivePinned ? 0 : 28, opacity: effectivePinned ? 1 : 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              // Below sm the dock's intrinsic width (~9 icons + dividers) can
              // exceed the viewport — let it scroll horizontally there instead
              // of clipping icons off-screen; desktop is untouched since it
              // already fits and this only engages when content overflows.
              className="flex items-center gap-0.5 px-2.5 py-2 max-w-[calc(100vw-1.5rem)] overflow-x-auto max-sm:[&::-webkit-scrollbar]:hidden"
              style={{ ...DOCK_STYLE, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
            >
              {/* ── Nav groups ── */}
              {groups.map((group, gi) => (
                <div key={gi} className="flex items-center gap-0.5 shrink-0">
                  {gi > 0 && (
                    <div
                      className="mx-1.5 h-5 w-px rounded-full shrink-0"
                      style={{ background: 'var(--border-default)' }}
                    />
                  )}

                  {group.items.map((item) => {
                    const isActive  = location.pathname === item.path;
                    const isLocked  = !item.isAdmin && (
                      (isFreeTier       && FREE_LOCKED.has(item.path)) ||
                      (isIndividualTier && INDIVIDUAL_LOCKED.has(item.path))
                    );
                    const isHov = hovered === item.path;
                    const Icon  = item.icon;

                    const iconColor = isActive
                      ? item.isAdmin ? '#f87171' : 'var(--accent)'
                      : isLocked ? 'var(--text-faint)'
                      : isHov    ? 'var(--text-primary)' : 'var(--text-muted)';

                    const activeBg  = item.isAdmin ? 'rgba(239,68,68,0.12)' : 'var(--accent-muted)';
                    const dotClass  = item.isAdmin ? 'bg-red-400'  : 'bg-blue-400';
                    const dotGlow   = item.isAdmin ? '#f87171'     : 'var(--accent)';

                    return (
                      <div
                        key={item.path}
                        className="relative shrink-0"
                        onMouseEnter={(e) => { setHovered(item.path); setTipAnchor(anchorFrom(e.currentTarget)); preloadDashboardRoute(item.path); }}
                        onMouseLeave={() => { setHovered(null); setTipAnchor(null); }}
                      >
                        {/* Icon button */}
                        <motion.div
                          role="button"
                          aria-label={item.name}
                          onClick={() => navigate(item.path)}
                          whileHover={{ scale: 1.18, y: -2 }}
                          whileTap={{ scale: 0.90 }}
                          transition={{ type: 'spring', stiffness: 480, damping: 22 }}
                          className="relative flex flex-col items-center justify-center cursor-pointer"
                          style={{
                            width: 44, height: 44, borderRadius: 20,
                            background: isActive ? activeBg : 'transparent',
                            transition: 'background 0.2s ease',
                          }}
                        >
                          <Icon style={{ width: 18, height: 18, color: iconColor, transition: 'color 0.15s ease' }} />
                          {isActive && (
                            <motion.span
                              layoutId="dock-active-dot"
                              className={`absolute bottom-1.5 w-1.25 h-1.25 rounded-full ${dotClass}`}
                              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                              style={{ boxShadow: `0 0 6px ${dotGlow}` }}
                            />
                          )}
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* ── Toggle (pin / auto-hide) button — hidden on touch, where
                    auto-hide has no way to reveal itself without a hover ── */}
              {!isTouch && (
              <div className="ml-1.5 flex items-center shrink-0">
                <div className="w-px h-5 mr-2 shrink-0" style={{ background: 'var(--border-subtle)' }} />

                <div
                  className="relative"
                  onMouseEnter={(e) => { setBtnHovered(true); setBtnAnchor(anchorFrom(e.currentTarget)); }}
                  onMouseLeave={() => { setBtnHovered(false); setBtnAnchor(null); }}
                >
                  <motion.button
                    aria-label={pinned ? 'Switch to auto-hide' : 'Pin dock'}
                    onClick={togglePin}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.90 }}
                    transition={{ type: 'spring', stiffness: 480, damping: 22 }}
                    className="relative flex flex-col items-center justify-center rounded-xl"
                    style={{ width: 36, height: 44 }}
                  >
                    {/* Icon rotates: down = pinned (click to collapse), up = auto-hide (click to pin) */}
                    <motion.div
                      animate={{ rotate: pinned ? 0 : 180 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    >
                      <ChevronDown style={{ width: 14, height: 14, color: pinned ? 'var(--text-faint)' : 'var(--accent)' }} />
                    </motion.div>

                    {/* Pinned state dot — visible always when pinned, hidden when auto-hide */}
                    <AnimatePresence>
                      {pinned && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute bottom-1.5 w-1.25 h-1.25 rounded-full bg-blue-400"
                          style={{ boxShadow: '0 0 5px var(--accent)' }}
                        />
                      )}
                    </AnimatePresence>
                  </motion.button>
                </div>
              </div>
              )}
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
