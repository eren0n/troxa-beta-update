import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, SquarePlus, Image, Palette,
  CreditCard, ChevronLeft, ChevronRight,
  X, Cpu, Building2, LogOut, Lock, Shield, Database, Video, Pencil, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from '../layout/Logo';
import { ProfileDropdown } from './ProfileDropdown';
import { useAuth } from '../../contexts/AuthContext';
import { preloadDashboardRoute } from '../../lib/dashboardRoutes';
import { mgmtApi } from '../../lib/api';

// Flat nav — no category headers, just a hairline divider between groups
// (see the `gi > 0` check below where these are rendered).
const navGroups = [
  {
    items: [
      { name: 'Home', icon: Home, path: '/dashboard' },
    ]
  },
  {
    items: [
      { name: 'Generate', icon: SquarePlus, path: '/dashboard/create-v2' },
      { name: 'Prompt Studio', icon: Sparkles, path: '/dashboard/prompt-studio' },
      { name: 'Make Video', icon: Video, path: '/dashboard/make-video' },
      { name: 'Edit', icon: Pencil, path: '/dashboard/editor' },
      { name: 'Gallery', icon: Image, path: '/dashboard/gallery' },
      { name: 'Brand Kit', icon: Palette, path: '/dashboard/brand-kit' },
      { name: 'Automation', icon: Cpu, path: '/dashboard/automation' },
    ]
  },
  {
    items: [
      // Team, Billing & Integrations merged into one page — Profile and
      // Settings live one click away via the profile dropdown instead.
      { name: 'Workspace', icon: Building2, path: '/dashboard/workspace' },
    ]
  }
];

const allNavItems = navGroups.flatMap(g => g.items);

const RMGS_ADMINS = new Set(['eren@rmgs.online', 'kaan@rmgs.online', 'tolga@rmgs.online']);

export const Sidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) => {
  const location = useLocation();
  const { credits, isFreeTier, isIndividualTier, isDataUser, user } = useAuth();
  const isRMGSAdmin = RMGS_ADMINS.has(user?.email);
  const [hasMgmtAccess, setHasMgmtAccess] = useState(false);

  useEffect(() => {
    if (!user) return;
    mgmtApi.myPermissions()
      .then(p => setHasMgmtAccess(p.tabs.length > 0 || p.is_upper_management))
      .catch(() => {});
  }, [user?.email]);
  const LOCKED_PATHS = ['/dashboard/brand-kit', '/dashboard/automation'];
  const INDIVIDUAL_LOCKED_PATHS = ['/dashboard/automation'];

  const planName = (typeof credits?.plan === 'string' ? credits.plan : credits?.plan?.name) || 'Free Trial';
  const creditBalance = credits?.balance ?? 0;
  const creditTotal = credits?.total ?? 0;  // null = unlimited
  const creditPct = creditTotal > 0 ? Math.round((creditBalance / creditTotal) * 100) : 0;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo Header */}
      <div className="px-5 flex items-center justify-between border-b border-white/5 h-16 lg:h-20 shrink-0">
        <AnimatePresence mode="wait">
          {(!collapsed || mobileOpen) ? (
            <motion.div
              key="full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2.5 min-w-0"
            >
              <Link to="/dashboard" className="flex items-center gap-2.5 group">
                <Logo className="w-8 h-8 shrink-0 group-hover:drop-shadow-accent transition-all" />
                <span className="text-base font-black text-white tracking-tight truncate">Troxa.ai</span>
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="icon"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mx-auto"
            >
              <Link to="/dashboard">
                <Logo className="w-8 h-8 hover:drop-shadow-accent transition-all" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
        {mobileOpen && (
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-2 text-gray-500 hover:text-white rounded-lg hover:bg-white/5 transition-all">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden px-3 space-y-1">
        {/* Admin section — RMGS Mgmt + Manage Data */}
        {(isRMGSAdmin || hasMgmtAccess || isDataUser) && (
          <div className="mb-2">
            {(isRMGSAdmin || hasMgmtAccess) && (
              <Link
                to="/dashboard/mgmt"
                onClick={() => mobileOpen && setMobileOpen(false)}
                onMouseEnter={() => preloadDashboardRoute('/dashboard/mgmt')}
                onFocus={() => preloadDashboardRoute('/dashboard/mgmt')}
                className={`relative flex items-center gap-3 rounded-xl transition-all duration-200 group ${
                  collapsed && !mobileOpen ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5'
                }`}
              >
                {location.pathname === '/dashboard/mgmt' && (
                  <motion.div
                    layoutId="sidebar-active-bg"
                    className="absolute inset-0 bg-red-500/10 border border-red-500/20 rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Shield
                  className={`relative z-10 shrink-0 transition-colors ${location.pathname === '/dashboard/mgmt' ? 'text-red-400' : 'text-red-800 group-hover:text-red-500'}`}
                  style={{ width: 18, height: 18 }}
                />
                {(!collapsed || mobileOpen) && (
                  <span className={`relative z-10 text-sm font-medium truncate transition-colors ${location.pathname === '/dashboard/mgmt' ? 'text-white font-semibold' : 'text-red-800 group-hover:text-red-400'}`}>
                    RMGS Management
                  </span>
                )}
                {collapsed && !mobileOpen && (
                  <div className="absolute left-14 bg-zinc-900 border border-white/10 px-3 py-1.5 rounded-lg text-white text-xs font-semibold opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity shadow-2xl z-50">
                    RMGS Management
                  </div>
                )}
              </Link>
            )}

            {false && isDataUser && (
              <Link
                to="/dashboard/manage-data"
                onClick={() => mobileOpen && setMobileOpen(false)}
                onMouseEnter={() => preloadDashboardRoute('/dashboard/manage-data')}
                onFocus={() => preloadDashboardRoute('/dashboard/manage-data')}
                className={`relative flex items-center gap-3 rounded-xl transition-all duration-200 group ${
                  collapsed && !mobileOpen ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5'
                }`}
              >
                {location.pathname === '/dashboard/manage-data' && (
                  <motion.div
                    layoutId="sidebar-active-bg"
                    className="absolute inset-0 bg-red-500/10 border border-red-500/20 rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Database
                  className={`relative z-10 shrink-0 transition-colors ${location.pathname === '/dashboard/manage-data' ? 'text-red-400' : 'text-red-800 group-hover:text-red-500'}`}
                  style={{ width: 18, height: 18 }}
                />
                {(!collapsed || mobileOpen) && (
                  <span className={`relative z-10 text-sm font-medium truncate transition-colors ${location.pathname === '/dashboard/manage-data' ? 'text-white font-semibold' : 'text-red-800 group-hover:text-red-400'}`}>
                    Manage Data
                  </span>
                )}
                {collapsed && !mobileOpen && (
                  <div className="absolute left-14 bg-zinc-900 border border-white/10 px-3 py-1.5 rounded-lg text-white text-xs font-semibold opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity shadow-2xl z-50">
                    Manage Data
                  </div>
                )}
              </Link>
            )}
          </div>
        )}

        {navGroups.map((group, gi) => (
          <div key={gi} className="mb-2">
            {(gi > 0 || isRMGSAdmin || hasMgmtAccess || isDataUser) && (
              <div className="my-2 mx-2 h-px bg-white/5" />
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.path;
                const isLocked = (isFreeTier && LOCKED_PATHS.includes(item.path))
                  || (isIndividualTier && INDIVIDUAL_LOCKED_PATHS.includes(item.path));
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => mobileOpen && setMobileOpen(false)}
                    onMouseEnter={() => preloadDashboardRoute(item.path)}
                    onFocus={() => preloadDashboardRoute(item.path)}
                    className={`relative flex items-center gap-3 rounded-xl transition-all duration-200 group ${
                      collapsed && !mobileOpen ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active-bg"
                        className="absolute inset-0 bg-blue-500/10 border border-blue-500/20 rounded-xl"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}

                    <item.icon className={`relative z-10 shrink-0 transition-colors ${
                      collapsed && !mobileOpen ? 'w-5 h-5' : 'w-4.5 h-4.5'
                    } ${isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-200'}`}
                      style={{ width: 18, height: 18 }}
                    />

                    {(!collapsed || mobileOpen) && (
                      <span className={`relative z-10 text-sm font-medium truncate transition-colors ${
                        isActive ? 'text-white font-semibold' : 'text-gray-400 group-hover:text-white'
                      }`}>
                        {item.name}
                      </span>
                    )}

                    {isLocked && (!collapsed || mobileOpen) && (
                      <Lock className="relative z-10 ml-auto w-3 h-3 text-slate-600 shrink-0" />
                    )}

                    {!isLocked && isActive && (!collapsed || mobileOpen) && (
                      <motion.div
                        layoutId="sidebar-active-dot"
                        className="relative z-10 ml-auto w-1.5 h-1.5 rounded-full bg-blue-400"
                      />
                    )}

                    {/* Collapsed tooltip */}
                    {collapsed && !mobileOpen && (
                      <div className="absolute left-14 bg-zinc-900 border border-white/10 px-3 py-1.5 rounded-lg text-white text-xs font-semibold opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity shadow-2xl z-50">
                        {item.name}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Profile — moved down here from the header for the classic layout */}
      <div className="p-3 border-t border-white/5 shrink-0">
        <ProfileDropdown variant="sidebar" collapsed={collapsed && !mobileOpen} />
      </div>

      {/* Collapse Toggle — rendered outside the aside so it can overflow */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setCollapsed(!collapsed)}
        className="fixed top-24 w-6 h-6 bg-zinc-900 border border-white/10 rounded-full hidden lg:flex items-center justify-center text-gray-400 hover:text-white z-60 shadow-xl hover:border-blue-500/30 transition-colors"
        style={{ left: collapsed ? 60 : 248 }}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </motion.button>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden lg:flex fixed left-0 top-0 h-screen bg-[#0a0d14] border-r border-white/5 z-50 flex-col"
      >
        {sidebarContent}
      </motion.aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed left-0 top-0 h-screen w-67.5 bg-[#0a0d14] border-r border-white/5 z-50 flex lg:hidden flex-col shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
