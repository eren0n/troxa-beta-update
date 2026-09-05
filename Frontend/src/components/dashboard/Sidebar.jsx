import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, SquarePlus, Image, Palette, Users,
  CreditCard, BarChart3, ChevronLeft, ChevronRight,
  X, Cpu, User, Settings, LogOut, Plug, Lock, Shield, Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from '../layout/Logo';
import { useAuth } from '../../contexts/AuthContext';

const navGroups = [
  {
    label: 'Workspace',
    items: [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { name: 'Activity', icon: BarChart3, path: '/dashboard/activity' },
    ]
  },
  {
    label: 'Creative',
    items: [
      { name: 'Generate', icon: SquarePlus, path: '/dashboard/create' },
      { name: 'Creatives', icon: Image, path: '/dashboard/creatives' },
      { name: 'Brand Kit', icon: Palette, path: '/dashboard/brand-kit' },
      { name: 'Automation', icon: Cpu, path: '/dashboard/automation' },
    ]
  },
  {
    label: 'Account',
    items: [
      { name: 'Team', icon: Users, path: '/dashboard/team' },
      { name: 'Billing', icon: CreditCard, path: '/dashboard/billing' },
      { name: 'Integrations', icon: Plug, path: '/dashboard/integrations' },
      { name: 'Profile', icon: User, path: '/dashboard/profile' },
      { name: 'Settings', icon: Settings, path: '/dashboard/settings' },
    ]
  }
];

const allNavItems = navGroups.flatMap(g => g.items);

const RMGS_ADMINS = new Set(['eren@rmgs.online', 'kaan@rmgs.online', 'tolga@rmgs.online']);

export const Sidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) => {
  const location = useLocation();
  const { credits, isFreeTier, isIndividualTier, user, isDataUser } = useAuth();
  const isRMGSAdmin = RMGS_ADMINS.has(user?.email);
  const LOCKED_PATHS = ['/dashboard/brand-kit', '/dashboard/automation', '/dashboard/team', '/dashboard/integrations'];
  const INDIVIDUAL_LOCKED_PATHS = ['/dashboard/automation', '/dashboard/team'];

  const planName = (typeof credits?.plan === 'string' ? credits.plan : credits?.plan?.name) || 'Free Trial';
  const creditBalance = credits?.balance ?? 0;
  const creditTotal = credits ? (credits.balance + (credits.used || 0)) : 10;
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
                <Logo className="w-8 h-8 shrink-0 group-hover:drop-shadow-[0_0_10px_rgba(59,130,246,0.4)] transition-all" />
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
                <Logo className="w-8 h-8 hover:drop-shadow-[0_0_10px_rgba(59,130,246,0.4)] transition-all" />
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
        {/* RMGS Admin link — only visible to eren@rmgs.online */}
        {isRMGSAdmin && (
          <div className="mb-2">
            <AnimatePresence>
              {(!collapsed || mobileOpen) && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[9px] font-black text-red-800 uppercase tracking-[0.2em] px-3 py-2"
                >
                  Admin
                </motion.p>
              )}
            </AnimatePresence>
            {collapsed && !mobileOpen && <div className="my-2 mx-2 h-px bg-white/5" />}
            <Link
              to="/dashboard/mgmt"
              onClick={() => mobileOpen && setMobileOpen(false)}
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

            {/* Manage Data — visible only to data users */}
            {isDataUser && (
              <Link
                to="/dashboard/manage-data"
                onClick={() => mobileOpen && setMobileOpen(false)}
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

        {navGroups.map((group) => (
          <div key={group.label} className="mb-2">
            <AnimatePresence>
              {(!collapsed || mobileOpen) && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] px-3 py-2"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>

            {collapsed && !mobileOpen && <div className="my-2 mx-2 h-px bg-white/5" />}

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

      {/* Credits Card */}
      <div className="p-3 border-t border-white/5 shrink-0">
        <AnimatePresence>
          {(!collapsed || mobileOpen) ? (
            <motion.div
              key="full-card"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-400">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">{planName}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-500">Credits</span>
                  <span className="text-white font-bold">{creditBalance} / {creditTotal}</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${creditPct}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                    className={`h-full rounded-full ${creditPct < 20 ? 'bg-red-500' : 'bg-linear-to-r from-blue-600 to-blue-400'}`}
                  />
                </div>
              </div>
              <Link
                to="/dashboard/billing"
                className="w-full text-center block py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/20 text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Upgrade
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="icon-card"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center"
            >
              <Link to="/dashboard/billing" className="p-2.5 bg-blue-500/10 border border-blue-500/15 rounded-xl text-blue-400 hover:bg-blue-500/20 transition-colors">
                <CreditCard className="w-4 h-4" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
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
