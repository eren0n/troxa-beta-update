import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useGoogleLogin } from '@react-oauth/google';
import { Mail, Lock, ArrowRight, Eye, EyeOff, Sparkles, Shield, Zap, BarChart3, Smartphone, ChevronLeft } from 'lucide-react';
import { Logo } from '../components/layout/Logo';
import { useAuth } from '../contexts/AuthContext';
import { inviteApi } from '../lib/api';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const features = [
  { icon: Sparkles, text: 'AI-powered creative generation at scale' },
  { icon: Shield, text: 'Compliance-first output for US iGaming operators' },
  { icon: Zap, text: 'Generate 100s of variations in seconds' },
  { icon: BarChart3, text: 'Real-time analytics and performance tracking' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('login');
  const [totpCode, setTotpCode] = useState('');
  const [googleToken, setGoogleToken] = useState(null);
  const [googleLinkEmail, setGoogleLinkEmail] = useState('');
  const [googleLinkPw, setGoogleLinkPw] = useState('');
  const [showGooglePw, setShowGooglePw] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const { login, loginWithGoogle, linkGoogleAccount } = useAuth();

  // Restore pending Google auth state after a potential page reload (redirect-mode OAuth)
  useEffect(() => {
    const raw = sessionStorage.getItem('troxa_google_pending');
    if (!raw) return;
    sessionStorage.removeItem('troxa_google_pending');
    try {
      const data = JSON.parse(raw);
      setGoogleToken(data.token);
      if (data.type === 'link') {
        setGoogleLinkEmail(data.email || '');
        setStep('google_link');
      } else if (data.type === '2fa') {
        setStep('google_2fa');
      }
    } catch (_) {}
  }, []);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError(null);
      try {
        const result = await loginWithGoogle(tokenResponse.access_token);
        if (result?.action === 'link_required') {
          sessionStorage.setItem('troxa_google_pending', JSON.stringify({ type: 'link', token: tokenResponse.access_token, email: result.email || '' }));
          setGoogleToken(tokenResponse.access_token);
          setGoogleLinkEmail(result.email || '');
          setGoogleLinkPw('');
          setStep('google_link');
          setLoading(false);
          return;
        }
        if (result?.requires_2fa) {
          sessionStorage.setItem('troxa_google_pending', JSON.stringify({ type: '2fa', token: tokenResponse.access_token }));
          setGoogleToken(tokenResponse.access_token);
          setTotpCode('');
          setStep('google_2fa');
          setLoading(false);
          return;
        }
        sessionStorage.removeItem('troxa_google_pending');
        navigate('/dashboard');
      } catch (err) {
        setError(err.message || 'Google sign-in failed');
        setLoading(false);
      }
    },
    onError: () => setError('Google sign-in failed'),
  });

  const handleGoogleLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await linkGoogleAccount(googleToken, googleLinkPw);
      sessionStorage.removeItem('troxa_google_pending');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Incorrect password');
      setLoading(false);
    }
  };

  const handleGoogle2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle(googleToken, totpCode);
      sessionStorage.removeItem('troxa_google_pending');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid 2FA code');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await login(email, password);
      if (result?.requires_2fa) {
        setStep('2fa');
        setLoading(false);
        return;
      }
      if (inviteToken) {
        try {
          const res = await inviteApi.accept(inviteToken);
          if (res?.workspace_id) localStorage.setItem('active_workspace_id', res.workspace_id);
        } catch (_) {}
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password');
      setLoading(false);
    }
  };

  const handle2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password, totpCode);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid 2FA code');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070d] flex">
      {/* Left Panel – Brand */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between py-8 pl-16 overflow-hidden bg-[#080b14]">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px]" />
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(59,130,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
          />
          <div className="absolute inset-y-0 right-0 w-56 pointer-events-none" style={{ background: 'linear-gradient(to right, transparent, #05070d)' }} />
        </div>

        {/* Logo */}
        <div className="relative z-10 mb-3">
          <Link to="/" className="flex items-center gap-3">
            <Logo className="w-12 h-12" />
            <span className="text-3xl font-black text-white">Troxa.ai</span>
          </Link>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Professional iGaming Platform</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight">
              The Creative Engine<br />for iGaming Teams
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed max-w-md">
              Generate thousands of compliant ad creatives in minutes. Built for licensed US operators.
            </p>
          </div>

          <ul className="space-y-4">
            {features.map((f, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-4"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-slate-300 text-sm font-medium">{f.text}</span>
              </motion.li>
            ))}
          </ul>

          {/* Mockup card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="p-5 bg-[#0c0f1a] border border-white/8 rounded-2xl max-w-sm mb-2"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-1">
                {[1,2,3].map(i => <div key={i} className="w-2 h-2 rounded-full bg-white/10" />)}
              </div>
              <span className="text-[10px] text-slate-600 font-mono">live_generation_feed</span>
              <div className="ml-auto flex items-center gap-1.5">
                <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[9px] text-slate-600">LIVE</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[...Array(7)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                  className="aspect-square rounded-lg bg-white/5 border border-white/5"
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Generating 7 creatives...</span>
              <span className="text-[10px] text-blue-400 font-bold">1.4s avg</span>
            </div>
          </motion.div>
        </div>

        {/* Bottom */}
        <div className="relative z-10 pl-4 flex items-center gap-6 text-[10px] text-slate-700">
          <span className="font-mono uppercase tracking-widest">B2B Platform</span>
          <span>·</span>
          <span>18+ Only</span>
          <span>·</span>
          <span>US Compliance Verified</span>
        </div>
      </div>

      {/* Right Panel – Form */}
      <div className="flex-1 sticky top-0 h-screen flex items-center justify-center p-6 lg:p-16 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 flex items-center gap-3">
            <Logo className="w-9 h-9" />
            <span className="text-xl font-black text-white">Troxa.ai</span>
          </div>

          <AnimatePresence mode="wait">
            {step === 'google_link' ? (
              <motion.div key="google_link" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <button onClick={() => { setStep('login'); setError(null); setGoogleToken(null); }}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-white text-xs font-bold mb-8 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Back to login
                </button>

                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <GoogleIcon />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-white">Link Google Account</h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                      {googleLinkEmail && <>An account already exists for <span className="text-white font-semibold">{googleLinkEmail}</span>.</>}
                    </p>
                  </div>
                </div>

                <p className="text-slate-400 text-sm mb-6">Enter your existing password to link your Google account. You won't be asked again after this.</p>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 font-medium">{error}</div>
                )}

                <form onSubmit={handleGoogleLink} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Your Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                      <input required type={showGooglePw ? 'text' : 'password'} value={googleLinkPw}
                        onChange={(e) => setGoogleLinkPw(e.target.value)}
                        placeholder="••••••••••••" autoFocus
                        className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3.5 pl-11 pr-11 text-white text-sm outline-none transition-all placeholder:text-slate-700" />
                      <button type="button" onClick={() => setShowGooglePw(!showGooglePw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors">
                        {showGooglePw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <motion.button type="submit" disabled={loading || !googleLinkPw} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Confirm & Sign In <ArrowRight className="w-4 h-4" /></>}
                  </motion.button>
                </form>
              </motion.div>
            ) : step === 'google_2fa' ? (
              <motion.div key="google_2fa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <button onClick={() => { setStep('login'); setError(null); setGoogleToken(null); setTotpCode(''); sessionStorage.removeItem('troxa_google_pending'); }}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-white text-xs font-bold mb-8 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Back to login
                </button>

                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Smartphone className="w-7 h-7 text-blue-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-white">Two-Factor Auth</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Open Google Authenticator and enter the 6-digit code for <span className="text-white font-semibold">Troxa.ai</span></p>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 font-medium">{error}</div>
                )}

                <form onSubmit={handleGoogle2FA} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Authentication Code</label>
                    <input required type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                      value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000" autoFocus
                      className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-4 px-5 text-white text-2xl font-black tracking-[0.4em] outline-none transition-all placeholder:text-slate-800 text-center" />
                  </div>
                  <motion.button type="submit" disabled={loading || totpCode.length !== 6} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Verify & Sign In <ArrowRight className="w-4 h-4" /></>}
                  </motion.button>
                </form>
              </motion.div>
            ) : step === 'login' ? (
              <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="mb-10">
                  <h1 className="text-3xl font-black text-white mb-2">Welcome back</h1>
                  <p className="text-slate-500">Sign in to your workspace to continue.</p>
                </div>

                <motion.button
                  type="button"
                  onClick={() => handleGoogleLogin()}
                  disabled={loading}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full flex items-center justify-center gap-3 py-3.5 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/15 rounded-xl font-semibold text-sm text-white transition-all mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <GoogleIcon />
                  Continue with Google
                </motion.button>

                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/6" /></div>
                  <div className="relative flex justify-center">
                    <span className="bg-[#05070d] px-4 text-[11px] text-slate-600 font-bold uppercase tracking-widest">or sign in with email</span>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 font-medium">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com"
                        className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3.5 pl-11 pr-4 text-white text-sm outline-none transition-all placeholder:text-slate-700" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Password</label>
                      <a href="#" tabIndex={-1} className="text-[11px] text-blue-400 font-bold hover:text-blue-300 transition-colors">Forgot password?</a>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                      <input required type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••"
                        className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3.5 pl-11 pr-11 text-white text-sm outline-none transition-all placeholder:text-slate-700" />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 mt-2">
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
                  </motion.button>
                </form>

                <p className="text-center mt-8 text-sm text-slate-600">
                  Don't have an account?{' '}
                  <Link to="/signup" className="text-blue-400 font-bold hover:text-blue-300 transition-colors">Create one free</Link>
                </p>
              </motion.div>
            ) : (
              <motion.div key="2fa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <button onClick={() => { setStep('login'); setError(null); setTotpCode(''); }}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-white text-xs font-bold mb-8 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Back to login
                </button>

                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Smartphone className="w-7 h-7 text-blue-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-white">Two-Factor Auth</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Open Google Authenticator and enter the 6-digit code for <span className="text-white font-semibold">Troxa.ai</span></p>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 font-medium">{error}</div>
                )}

                <form onSubmit={handle2FA} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Authentication Code</label>
                    <input
                      required
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      autoFocus
                      className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-4 px-5 text-white text-2xl font-black tracking-[0.4em] outline-none transition-all placeholder:text-slate-800 text-center"
                    />
                  </div>
                  <motion.button type="submit" disabled={loading || totpCode.length !== 6} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Verify & Sign In <ArrowRight className="w-4 h-4" /></>}
                  </motion.button>
                </form>

                <p className="text-center mt-6 text-xs text-slate-600">
                  Lost access to your authenticator?{' '}
                  <a href="mailto:support@troxa.ai" className="text-blue-400 hover:text-blue-300 transition-colors">Contact support</a>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-10 p-4 bg-white/2 border border-white/5 rounded-xl flex items-center gap-3">
            <Shield className="w-4 h-4 text-slate-600 shrink-0" />
            <p className="text-[10px] text-slate-700 leading-relaxed">
              Secure B2B login. Your credentials are encrypted and never shared. For licensed iGaming professionals only.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
