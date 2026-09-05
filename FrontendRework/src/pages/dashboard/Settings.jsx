import { useState, useEffect } from 'react';
import {
  Shield, Bell, Palette, Globe, Lock, Eye, EyeOff,
  ChevronRight, Check, Mail, Webhook,
  Trash2, RefreshCw, AlertTriangle, User, CreditCard,
  Loader2, ExternalLink, Calendar, Sparkles,
  Smartphone, X, Copy, CheckCircle, Moon, Sun, Layout, Monitor,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../lib/api';
import { GLASS_STYLE } from '../../components/ui/GlassCard';
import { useTheme } from '../../contexts/ThemeContext';

function Toggle({ enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex rounded-full transition-colors duration-300 focus:outline-none shrink-0 ${enabled ? 'bg-blue-600' : 'bg-zinc-700'}`}
      style={{ width: 40, height: 22 }}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className={`absolute top-0.5 bg-white rounded-full shadow-md ${enabled ? 'left-5' : 'left-0.5'}`}
        style={{ width: 18, height: 18 }}
      />
    </button>
  );
}

const tabs = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

const NOTIF_DEFAULTS = {
  generationComplete: true,
  campaignApproval: true,
  teamInvite: true,
  weeklyReport: false,
  marketingEmails: false,
  complianceAlerts: true,
  billingAlerts: true,
  apiUsage: false,
};

const APPEARANCE_DEFAULTS = {
  theme: 'dark',
  density: 'comfortable',
  animationsEnabled: true,
  sidebarCompact: false,
  accentColor: 'blue',
};

const SECURITY_DEFAULTS = {
  twoFactor: false,
  sessionAlerts: true,
  ipWhitelist: false,
};

function loadLS(key, defaults) {
  try {
    const s = localStorage.getItem(key);
    return s ? { ...defaults, ...JSON.parse(s) } : { ...defaults };
  } catch { return { ...defaults }; }
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function Settings() {
  const { user, credits, refreshUser } = useAuth();
  const { uiDesign, colorMode, setUiDesign, setColorMode } = useTheme();
  const [activeTab, setActiveTab] = useState('account');
  const [toast, setToast] = useState({ show: false, message: 'Settings saved', type: 'success' });

  const [notifs, setNotifs] = useState(() => loadLS('settings_notifs', NOTIF_DEFAULTS));
  const [appearance, setAppearance] = useState(() => loadLS('settings_appearance', APPEARANCE_DEFAULTS));
  const [securityToggles, setSecurityToggles] = useState(() => loadLS('settings_security', SECURITY_DEFAULTS));

  // Password change
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Danger zone
  const [dangerConfirm, setDangerConfirm] = useState(null);

  // 2FA state
  const [twoFAModal, setTwoFAModal] = useState(null); // null | 'setup' | 'disable'
  const [twoFAStep, setTwoFAStep] = useState('loading'); // loading | scan | done
  const [twoFAQr, setTwoFAQr] = useState(null);
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFAError, setTwoFAError] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  const showToast = (message = 'Settings saved', type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  };

  const handleSaveNotifs = () => {
    localStorage.setItem('settings_notifs', JSON.stringify(notifs));
    showToast('Notification preferences saved');
  };

  const handleSaveAppearance = () => {
    localStorage.setItem('settings_appearance', JSON.stringify(appearance));
    showToast('Appearance settings saved');
  };

  const handleSaveSecurityToggles = () => {
    localStorage.setItem('settings_security', JSON.stringify(securityToggles));
    showToast('Security settings saved');
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) { setPwError('All fields are required.'); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError('New passwords do not match.'); return; }
    if (pwForm.next.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    setPwLoading(true);
    try {
      await authApi.changePassword(pwForm.current, pwForm.next);
      setPwForm({ current: '', next: '', confirm: '' });
      showToast('Password updated successfully');
    } catch (e) {
      setPwError(e.message || 'Failed to change password.');
    } finally {
      setPwLoading(false);
    }
  };

  const openSetup2FA = async () => {
    setTwoFAModal('setup');
    setTwoFAStep('loading');
    setTwoFACode('');
    setTwoFAError('');
    try {
      const data = await authApi.setup2FA();
      setTwoFAQr(data.qr_code);
      setTwoFASecret(data.secret);
      setTwoFAStep('scan');
    } catch (e) {
      setTwoFAError(e.message || 'Failed to initialize 2FA setup');
      setTwoFAStep('scan');
    }
  };

  const handleConfirm2FA = async () => {
    setTwoFALoading(true);
    setTwoFAError('');
    try {
      await authApi.confirm2FA(twoFACode);
      await refreshUser();
      setTwoFAStep('done');
    } catch (e) {
      setTwoFAError(e.message || 'Invalid code');
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleDisable2FA = async () => {
    setTwoFALoading(true);
    setTwoFAError('');
    try {
      await authApi.disable2FA(twoFACode);
      await refreshUser();
      setTwoFAModal(null);
      showToast('2FA disabled');
    } catch (e) {
      setTwoFAError(e.message || 'Invalid code');
    } finally {
      setTwoFALoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(twoFASecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const planName = (typeof credits?.plan === 'string' ? credits.plan : credits?.plan?.name) || 'Free Trial';

  const accentColors = [
    { id: 'blue', color: '#3b82f6' },
    { id: 'purple', color: '#8b5cf6' },
    { id: 'emerald', color: '#10b981' },
    { id: 'amber', color: '#f59e0b' },
    { id: 'rose', color: '#f43f5e' },
  ];

  return (
    <div className="space-y-8 pb-20 text-left">
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className={`fixed top-24 right-8 text-white font-bold p-4 rounded-xl shadow-2xl z-50 flex items-center gap-3 border ${
              toast.type === 'error'
                ? 'bg-red-500 border-red-400'
                : 'bg-blue-500 border-blue-400'
            }`}
          >
            <Check className="w-5 h-5 bg-white text-blue-500 rounded-full p-0.5" />
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Danger zone confirm overlay */}
      <AnimatePresence>
        {dangerConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDangerConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[rgba(16,20,29,0.60)] backdrop-blur-xl backdrop-saturate-150 border border-red-500/30 rounded-3xl p-8 max-w-md w-full space-y-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">{dangerConfirm.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-gray-400">{dangerConfirm.desc}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDangerConfirm(null)}
                  className="flex-1 py-2.5 bg-zinc-900 border border-white/5 text-gray-400 rounded-xl text-sm font-bold transition-colors hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { dangerConfirm.onConfirm(); setDangerConfirm(null); }}
                  className="flex-1 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl text-sm font-bold transition-colors"
                >
                  {dangerConfirm.btnLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2FA Modal */}
      <AnimatePresence>
        {twoFAModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[rgba(16,20,29,0.60)] backdrop-blur-xl backdrop-saturate-150 border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6"
            >
              {twoFAModal === 'setup' && (
                <>
                  {twoFAStep === 'done' ? (
                    <div className="text-center space-y-4 py-4">
                      <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto">
                        <CheckCircle className="w-8 h-8 text-emerald-400" />
                      </div>
                      <h3 className="text-lg font-black text-white">2FA Enabled!</h3>
                      <p className="text-sm text-gray-400">Your account is now protected with Google Authenticator.</p>
                      <button
                        onClick={() => { setTwoFAModal(null); showToast('Two-factor authentication enabled'); }}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                            <Smartphone className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-white">Set Up 2FA</h3>
                            <p className="text-xs text-gray-500">Google Authenticator</p>
                          </div>
                        </div>
                        <button onClick={() => setTwoFAModal(null)} className="text-gray-500 hover:text-white transition-colors">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {twoFAStep === 'loading' ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                        </div>
                      ) : (
                        <div className="space-y-5">
                          <div className="text-sm text-gray-400 space-y-1">
                            <p><span className="text-white font-bold">1.</span> Download Google Authenticator on your phone</p>
                            <p><span className="text-white font-bold">2.</span> Tap <span className="text-white">+</span> and scan the QR code below</p>
                            <p><span className="text-white font-bold">3.</span> Enter the 6-digit code to confirm</p>
                          </div>

                          {twoFAQr && (
                            <div className="flex justify-center">
                              <div className="p-3 bg-white rounded-2xl">
                                <img src={twoFAQr} alt="2FA QR Code" className="w-48 h-48" />
                              </div>
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Manual Entry Key</p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-blue-400 font-mono tracking-widest break-all">{twoFASecret}</code>
                              <button onClick={copySecret} className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors shrink-0">
                                {secretCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Verification Code</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]{6}"
                              maxLength={6}
                              value={twoFACode}
                              onChange={e => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="000000"
                              className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-white text-xl font-black tracking-[0.5em] text-center focus:border-blue-500 outline-none transition-all placeholder:text-gray-800"
                            />
                          </div>

                          {twoFAError && (
                            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{twoFAError}</p>
                          )}

                          <button
                            onClick={handleConfirm2FA}
                            disabled={twoFALoading || twoFACode.length !== 6}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                          >
                            {twoFALoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                            {twoFALoading ? 'Verifying...' : 'Verify & Enable 2FA'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {twoFAModal === 'disable' && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">Disable 2FA</h3>
                        <p className="text-xs text-gray-500">Enter your authenticator code</p>
                      </div>
                    </div>
                    <button onClick={() => setTwoFAModal(null)} className="text-gray-500 hover:text-white transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-sm text-gray-400">Open Google Authenticator and enter the 6-digit code for <span className="text-white">Troxa.ai</span> to confirm.</p>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Authentication Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={twoFACode}
                      onChange={e => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      autoFocus
                      className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-white text-xl font-black tracking-[0.5em] text-center focus:border-blue-500 outline-none transition-all placeholder:text-gray-800"
                    />
                  </div>

                  {twoFAError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{twoFAError}</p>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setTwoFAModal(null)} className="flex-1 py-3 bg-zinc-900 border border-white/5 text-gray-400 rounded-xl font-bold hover:text-white transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={handleDisable2FA}
                      disabled={twoFALoading || twoFACode.length !== 6}
                      className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 disabled:opacity-50 text-red-400 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      {twoFALoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {twoFALoading ? 'Disabling...' : 'Disable 2FA'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white uppercase flex items-center gap-3">
          <Shield className="w-7 h-7 text-blue-500" /> Settings
        </h1>
        <p className="text-gray-500 mt-2 text-sm italic">Manage your account preferences, security, and integrations</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar tabs */}
        <nav className="lg:w-56 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 shrink-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="settings-active-tab"
                    className="absolute inset-0 bg-blue-500/10 border border-blue-500/20 rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <tab.icon className={`w-4 h-4 relative z-10 shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >

              {/* ACCOUNT */}
              {activeTab === 'account' && (
                <div className="space-y-6">
                  <div style={GLASS_STYLE} className="p-8 rounded-3xl space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">Account Overview</h3>
                      <Link
                        to="/dashboard/profile"
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/20 text-blue-400 rounded-xl text-xs font-bold transition-colors"
                      >
                        <User className="w-3.5 h-3.5" /> Edit Profile <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { label: 'Full Name', value: user?.full_name || user?.first_name || '—', icon: User },
                        { label: 'Email Address', value: user?.email || '—', icon: Mail },
                        { label: 'Current Plan', value: planName, icon: CreditCard },
                        { label: 'Member Since', value: formatDate(user?.date_joined), icon: Calendar },
                        { label: 'Location', value: user?.location || 'Not set', icon: Globe },
                        { label: 'Timezone', value: user?.timezone || 'Not set', icon: Globe },
                      ].map((field) => (
                        <div key={field.label} className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                            <field.icon className="w-3 h-3" /> {field.label}
                          </label>
                          <p className="text-sm text-gray-300 py-2.5 px-4 bg-black/40 border border-white/5 rounded-xl truncate">{field.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-white/5">
                      <p className="text-xs text-gray-500">
                        To update your name, bio, location, timezone, social links, or profile photo — go to your{' '}
                        <Link to="/dashboard/profile" className="text-blue-400 hover:underline">Profile page</Link>.
                      </p>
                    </div>
                  </div>

                  <div className="p-8 bg-red-500/5 border border-red-500/10 rounded-3xl space-y-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <h3 className="text-sm font-extrabold uppercase tracking-widest text-red-400">Danger Zone</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-black/40 border border-red-500/5 rounded-2xl">
                        <div>
                          <p className="text-sm font-bold text-white">Delete all generated creatives</p>
                          <p className="text-xs text-gray-500 mt-1">Permanently removes all your generated creatives and their metadata.</p>
                        </div>
                        <button
                          onClick={() => setDangerConfirm({
                            title: 'Delete all creatives?',
                            desc: 'This will permanently delete all generated creatives in your workspace. This action cannot be undone.',
                            btnLabel: 'Delete All',
                            onConfirm: () => showToast('Feature coming soon — contact support', 'error'),
                          })}
                          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Creatives
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-black/40 border border-red-500/5 rounded-2xl">
                        <div>
                          <p className="text-sm font-bold text-white">Delete account</p>
                          <p className="text-xs text-gray-500 mt-1">Permanently deletes your account, all creatives, and workspace data. Irreversible.</p>
                        </div>
                        <button
                          onClick={() => setDangerConfirm({
                            title: 'Delete your account?',
                            desc: 'Your account, all creatives, workspaces, and data will be permanently deleted. There is no way to recover this.',
                            btnLabel: 'Delete Account',
                            onConfirm: () => showToast('Feature coming soon — contact support', 'error'),
                          })}
                          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shrink-0"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> Delete Account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* NOTIFICATIONS */}
              {activeTab === 'notifications' && (
                <div style={GLASS_STYLE} className="p-8 rounded-3xl space-y-8">
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">Notification Preferences</h3>

                  {[
                    {
                      category: 'Creative Generation',
                      items: [
                        { key: 'generationComplete', label: 'Generation complete', desc: 'Notify when an AI generation run finishes' },
                        { key: 'campaignApproval', label: 'Creative approval requests', desc: 'When a team member marks a creative for review' },
                      ]
                    },
                    {
                      category: 'Team & Workspace',
                      items: [
                        { key: 'teamInvite', label: 'Team invitations', desc: 'When you receive a workspace invite' },
                        { key: 'apiUsage', label: 'API usage alerts', desc: 'Notify when API usage exceeds 80% of quota' },
                      ]
                    },
                    {
                      category: 'Compliance & Security',
                      items: [
                        { key: 'complianceAlerts', label: 'Compliance flag alerts', desc: 'When a creative is flagged for compliance review' },
                        { key: 'sessionAlerts', label: 'New sign-in alerts', desc: 'When your account is accessed from a new device' },
                      ]
                    },
                    {
                      category: 'Billing & Reports',
                      items: [
                        { key: 'billingAlerts', label: 'Billing notifications', desc: 'Invoice receipts and payment confirmations' },
                        { key: 'weeklyReport', label: 'Weekly performance report', desc: 'Summary of creative output and engagement' },
                        { key: 'marketingEmails', label: 'Product updates & marketing', desc: 'News about new features and platform updates' },
                      ]
                    }
                  ].map((group) => (
                    <div key={group.category} className="space-y-4">
                      <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-3">{group.category}</h4>
                      {group.items.map((item) => (
                        <div key={item.key} className="flex items-center justify-between gap-4 p-4 rounded-2xl hover:bg-white/2 transition-colors">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                          </div>
                          <Toggle
                            enabled={notifs[item.key]}
                            onToggle={() => setNotifs(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                          />
                        </div>
                      ))}
                    </div>
                  ))}

                  <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                    <div className="flex gap-3">
                      {[{ icon: Mail, label: 'Email' }, { icon: Webhook, label: 'Webhook' }].map((ch) => (
                        <button key={ch.label} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-xs text-gray-400 transition-colors">
                          <ch.icon className="w-3.5 h-3.5" /> {ch.label}
                        </button>
                      ))}
                    </div>
                    <button onClick={handleSaveNotifs} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-colors">
                      Save Preferences
                    </button>
                  </div>
                </div>
              )}

              {/* SECURITY */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div style={GLASS_STYLE} className="p-8 rounded-3xl space-y-6">
                    <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">Change Password</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Current Password</label>
                        <div className="relative">
                          <input
                            type={showCurrentPw ? 'text' : 'password'}
                            value={pwForm.current}
                            onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                            placeholder="••••••••••••"
                            className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 pr-10 text-sm text-white focus:border-blue-500 outline-none transition-all"
                          />
                          <button type="button" onClick={() => setShowCurrentPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                            {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">New Password</label>
                        <div className="relative">
                          <input
                            type={showNewPw ? 'text' : 'password'}
                            value={pwForm.next}
                            onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                            placeholder="••••••••••••"
                            className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 pr-10 text-sm text-white focus:border-blue-500 outline-none transition-all"
                          />
                          <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                            {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Confirm New Password</label>
                        <input
                          type="password"
                          value={pwForm.confirm}
                          onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                          placeholder="••••••••••••"
                          className="w-full sm:w-1/2 bg-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                    {pwError && (
                      <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{pwError}</p>
                    )}
                    <div className="flex justify-end">
                      <button
                        onClick={handleChangePassword}
                        disabled={pwLoading}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-colors flex items-center gap-2"
                      >
                        {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        {pwLoading ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </div>

                  <div style={GLASS_STYLE} className="p-8 rounded-3xl space-y-6">
                    <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">Security Settings</h3>

                    {/* 2FA row */}
                    <div className="flex items-center justify-between gap-4 p-4 bg-black/30 border border-white/5 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${user?.totp_enabled ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-gray-500/10 border-gray-500/20'}`}>
                          <Smartphone className={`w-4 h-4 ${user?.totp_enabled ? 'text-emerald-400' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white flex items-center gap-2">
                            Two-Factor Authentication
                            {user?.totp_enabled && <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">Active</span>}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {user?.totp_enabled ? 'Your account is protected with Google Authenticator' : 'Add an extra layer of security with Google Authenticator'}
                          </p>
                        </div>
                      </div>
                      {user?.totp_enabled ? (
                        <button
                          onClick={() => { setTwoFAModal('disable'); setTwoFACode(''); setTwoFAError(''); }}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-colors shrink-0"
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          onClick={openSetup2FA}
                          className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-xl text-xs font-bold transition-colors shrink-0"
                        >
                          Enable
                        </button>
                      )}
                    </div>

                    {[
                      { key: 'sessionAlerts', label: 'New Device Login Alerts', desc: 'Receive email notifications for logins from unrecognized devices.' },
                      { key: 'ipWhitelist', label: 'IP Whitelist Enforcement', desc: 'Restrict API access to pre-approved IP address ranges.' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between gap-4 p-4 rounded-2xl hover:bg-white/2 transition-colors">
                        <div>
                          <p className="text-sm font-semibold text-white">{item.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                        </div>
                        <Toggle
                          enabled={securityToggles[item.key]}
                          onToggle={() => setSecurityToggles(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                        />
                      </div>
                    ))}
                    <div className="flex justify-end pt-2">
                      <button onClick={handleSaveSecurityToggles} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors">Save</button>
                    </div>
                  </div>
                </div>
              )}

              {/* APPEARANCE */}
              {activeTab === 'appearance' && (
                <div className="space-y-6">

                  {/* UI Design */}
                  <div style={GLASS_STYLE} className="p-8 rounded-3xl space-y-6">
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">UI Design</h3>
                      <p className="text-xs text-gray-500 mt-1">Choose your dashboard navigation and layout style.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {
                          id: 'rework',
                          label: 'Rework',
                          subtitle: 'Bottom dock · Glassmorphism',
                          preview: (
                            <div className="w-full h-20 rounded-xl overflow-hidden relative bg-[#05070d] border border-white/10">
                              <div className="absolute inset-0 bg-linear-to-br from-blue-900/30 via-transparent to-purple-900/20" />
                              <div className="absolute top-2.5 left-2.5 right-2.5 h-7 rounded-lg border border-white/10 bg-white/5 flex items-center px-2.5 gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-sm bg-blue-500/60" />
                                <div className="h-1 w-12 rounded-full bg-white/20" />
                              </div>
                              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/10 bg-black/60">
                                {[...Array(5)].map((_, i) => (
                                  <div key={i} className={`w-3.5 h-3.5 rounded-md ${i === 0 ? 'bg-blue-500/60' : 'bg-white/10'}`} />
                                ))}
                              </div>
                            </div>
                          ),
                        },
                        {
                          id: 'classic',
                          label: 'Classic',
                          subtitle: 'Sidebar · Structured',
                          preview: (
                            <div className="w-full h-20 rounded-xl overflow-hidden relative bg-[#0b0e1a] border border-white/10 flex">
                              <div className="w-10 h-full border-r border-white/5 bg-black/40 flex flex-col items-center pt-2.5 gap-1.5 shrink-0">
                                {[...Array(5)].map((_, i) => (
                                  <div key={i} className={`w-5 h-5 rounded-lg ${i === 0 ? 'bg-blue-500/60' : 'bg-white/8'}`} />
                                ))}
                              </div>
                              <div className="flex-1 p-2.5 space-y-1.5">
                                <div className="h-1.5 w-14 rounded-full bg-white/20" />
                                <div className="grid grid-cols-2 gap-1">
                                  {[...Array(4)].map((_, i) => (
                                    <div key={i} className="h-5 rounded-lg bg-white/5 border border-white/5" />
                                  ))}
                                </div>
                              </div>
                            </div>
                          ),
                        },
                      ].map((d) => (
                        <button
                          key={d.id}
                          onClick={() => setUiDesign(d.id)}
                          className={`p-4 rounded-2xl border text-left transition-all ${uiDesign === d.id ? 'border-blue-500 bg-blue-500/10 shadow-accent-glow' : 'border-white/5 hover:border-white/10'}`}
                        >
                          {d.preview}
                          <div className="mt-3 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-black text-white">{d.label}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">{d.subtitle}</p>
                            </div>
                            {uiDesign === d.id && (
                              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Mode */}
                  <div style={GLASS_STYLE} className="p-8 rounded-3xl space-y-6">
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">Color Mode</h3>
                      <p className="text-xs text-gray-500 mt-1">Switch between dark, light, or the warm sunset palette.</p>
                    </div>

                    <div className="space-y-2.5">
                      {[
                        {
                          id: 'dark',
                          label: 'Dark',
                          subtitle: 'Default — deep navy blacks',
                          icon: Moon,
                          palette: ['#05070d', '#10141d', '#1e2433', '#3b82f6'],
                        },
                        {
                          id: 'light',
                          label: 'Light',
                          subtitle: 'Clean — soft slate whites',
                          icon: Sun,
                          palette: ['#f0f4f8', '#e2e8f0', '#94a3b8', '#2563eb'],
                        },
                        {
                          id: 'custom',
                          label: 'Sunset',
                          subtitle: 'Warm — cream pastel + orange',
                          icon: Sparkles,
                          palette: ['#fdf8f1', '#f3ebe0', '#e8d5b8', '#f97316'],
                        },
                      ].map((c) => {
                        const Icon = c.icon;
                        return (
                          <button
                            key={c.id}
                            onClick={() => setColorMode(c.id)}
                            className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-4 ${colorMode === c.id ? 'border-blue-500 bg-blue-500/10 shadow-accent-glow' : 'border-white/5 hover:border-white/10'}`}
                          >
                            <div className="w-14 h-9 rounded-xl overflow-hidden border border-white/10 shrink-0 flex">
                              {c.palette.map((color, i) => (
                                <div key={i} className="flex-1 h-full" style={{ background: color }} />
                              ))}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <p className="text-xs font-black text-white">{c.label}</p>
                              </div>
                              <p className="text-[10px] text-gray-500 mt-0.5">{c.subtitle}</p>
                            </div>
                            {colorMode === c.id && (
                              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
