import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Settings, LogOut, User, ChevronDown, Sparkles, Shield, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';

export const ProfileDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user, credits, logout } = useAuth();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsOpen(false);
    logout();
    navigate('/login');
  };

  const displayName = user
    ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email?.split('@')[0] || 'User'
    : 'User';

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarUrl = user?.avatar_url;
  const planName  = (typeof credits?.plan === 'string' ? credits.plan : credits?.plan?.name) || 'Free Trial';
  const planTier  = credits?.plan_tier || credits?.plan?.tier || 'free';
  const balance   = credits?.balance ?? 0;

  const TIER_BADGE = {
    free:       'bg-slate-500/10 text-slate-400 border-slate-500/20',
    individual: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    team:       'bg-purple-500/10 text-purple-400 border-purple-500/20',
    enterprise: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  const menuItems = [
    { icon: User,       label: 'My Profile', to: '/dashboard/profile' },
    { icon: Settings,   label: 'Settings',   to: '/dashboard/settings' },
    { icon: CreditCard, label: 'Billing',     to: '/dashboard/billing' },
  ];

  const AvatarEl = ({ size = 'sm' }) => {
    const cls = size === 'lg'
      ? 'w-10 h-10 rounded-xl text-sm border border-blue-500/30 shrink-0'
      : 'w-8 h-8 rounded-xl text-xs shadow-lg shadow-blue-600/20 border border-blue-500/30';
    return avatarUrl ? (
      <img
        src={avatarUrl}
        alt={displayName}
        className={`${cls} object-cover`}
      />
    ) : (
      <div className={`${cls} bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center font-black`}>
        {initials}
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 pl-2 group cursor-pointer"
      >
        <AvatarEl size="sm" />
        <div className="hidden lg:block text-left">
          <p className="text-sm font-semibold leading-none text-white group-hover:text-blue-400 transition-colors truncate max-w-28">{displayName}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">{planName}</p>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute top-full right-0 mt-3 w-64 bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* User Info */}
            <div className="p-4 border-b border-white/5 bg-gradient-to-br from-blue-900/10 to-transparent">
              <div className="flex items-center gap-3">
                <AvatarEl size="lg" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>

              {/* Plan + credits */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border ${TIER_BADGE[planTier] || TIER_BADGE.free}`}>
                  <Sparkles className="w-2.5 h-2.5" /> {planName}
                </span>
                {planTier !== 'free' && (
                  <span className="flex items-center gap-1 text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    <Shield className="w-2.5 h-2.5" /> Active
                  </span>
                )}
              </div>

              {/* Credit bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-slate-600 uppercase tracking-widest font-bold">Credits</span>
                  <span className="text-[10px] font-black text-white">{balance.toLocaleString()}</span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-700"
                    style={{ width: `${credits ? Math.min(100, (balance / (credits.total || balance || 1)) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2">
              {menuItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all text-gray-400 hover:text-white group"
                >
                  <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-blue-500/10 flex items-center justify-center transition-colors">
                    <item.icon className="w-3.5 h-3.5 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              ))}
            </div>

            {/* Sign Out */}
            <div className="p-2 border-t border-white/5">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-500/10 transition-all text-gray-400 hover:text-red-400 group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-red-500/10 flex items-center justify-center transition-colors">
                  <LogOut className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
