import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2, Mail, Lock, Eye, EyeOff, User, CheckCircle2, XCircle, AlertTriangle, LogOut } from 'lucide-react';
import { Logo } from '../components/layout/Logo';
import { useAuth } from '../contexts/AuthContext';
import { inviteApi, setTokens } from '../lib/api';

export default function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, user, login, logout, refreshUser } = useAuth();

  const [invite, setInvite] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    inviteApi.getPublic(token)
      .then(data => {
        setInvite(data);
        setEmail(data.email);
      })
      .catch(() => setFetchError('This invite link is invalid or has already been used.'));
  }, [token]);

  // Auto-accept if logged in with the correct account
  useEffect(() => {
    if (authLoading || !invite || !isAuthenticated) return;
    if (user?.email?.toLowerCase() !== invite.email?.toLowerCase()) return; // wrong account — show message
    inviteApi.accept(token)
      .then(res => {
        setAccepted(true);
        if (res?.workspace_id) localStorage.setItem('active_workspace_id', res.workspace_id);
        refreshUser().finally(() => setTimeout(() => navigate('/dashboard'), 1500));
      })
      .catch(() => navigate('/dashboard'));
  }, [authLoading, isAuthenticated, invite, user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await login(email, password);
      const res = await inviteApi.accept(token);
      if (res?.workspace_id) localStorage.setItem('active_workspace_id', res.workspace_id);
      setAccepted(true);
      await refreshUser();
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setFormError(err.message || 'Invalid email or password');
      setSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await inviteApi.registerWithInvite({ invite_token: token, email, password, first_name: firstName, last_name: lastName });
      setTokens(res.access, res.refresh);
      if (res.workspace_id) localStorage.setItem('active_workspace_id', res.workspace_id);
      setAccepted(true);
      await refreshUser();
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setFormError(err.message || 'Registration failed');
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    try { await logout(); } catch (_) {}
    setLoggingOut(false);
  };

  // Still loading
  if (authLoading || (isAuthenticated && invite && user?.email?.toLowerCase() === invite.email?.toLowerCase() && !accepted && !fetchError)) {
    return (
      <div className="min-h-screen bg-[#05070d] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Wrong account logged in
  const wrongAccount = isAuthenticated && invite && user?.email?.toLowerCase() !== invite.email?.toLowerCase();

  return (
    <div className="min-h-screen bg-[#05070d] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <Link to="/" className="inline-flex items-center gap-3 mb-8">
          <Logo className="w-9 h-9" />
          <span className="text-xl font-black text-white">Troxa.ai</span>
        </Link>

        {fetchError ? (
          <div className="p-8 bg-[#0c0f1a] border border-white/8 rounded-2xl text-center space-y-4">
            <XCircle className="w-12 h-12 text-red-400 mx-auto" />
            <p className="text-white font-bold text-lg">Invalid Invite</p>
            <p className="text-slate-400 text-sm">{fetchError}</p>
            <Link to="/login" className="inline-block mt-2 text-blue-400 text-sm font-bold hover:text-blue-300 transition-colors">
              Go to Sign In →
            </Link>
          </div>

        ) : accepted ? (
          <div className="p-8 bg-[#0c0f1a] border border-white/8 rounded-2xl text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-white font-bold text-lg">You're in!</p>
            <p className="text-slate-400 text-sm">Joining <strong className="text-white">{invite?.workspace_name}</strong>…</p>
          </div>

        ) : wrongAccount ? (
          <div className="bg-[#0c0f1a] border border-white/8 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/6">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Workspace Invitation</p>
              <h1 className="text-xl font-black text-white">Join <span className="text-blue-400">{invite.workspace_name}</span></h1>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-amber-300 font-bold mb-1">Wrong account</p>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    You're signed in as <span className="text-white font-bold">{user?.email}</span>, but this invite is for <span className="text-white font-bold">{invite.email}</span>.
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                disabled={loggingOut}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/8 text-white font-black text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                Sign out and continue
              </button>
            </div>
          </div>

        ) : invite ? (
          <div className="bg-[#0c0f1a] border border-white/8 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/6">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Workspace Invitation</p>
              <h1 className="text-xl font-black text-white leading-snug">
                Join <span className="text-blue-400">{invite.workspace_name}</span>
              </h1>
              {invite.invited_by && (
                <p className="text-sm text-slate-400 mt-1">Invited by <span className="text-white/70">{invite.invited_by}</span></p>
              )}
              <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 bg-white/5 border border-white/8 rounded-full">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{invite.role}</span>
              </div>
            </div>

            <div className="p-6">
              {invite.has_account ? (
                // Account exists — show sign in form only
                <form onSubmit={handleLogin} className="space-y-3">
                  <p className="text-xs text-slate-500 mb-4">Sign in to <span className="text-white font-bold">{invite.email}</span> to accept this invite.</p>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Password"
                      required
                      className="w-full pl-9 pr-10 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500/50 transition-colors"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formError && <p className="text-red-400 text-xs">{formError}</p>}
                  <button type="submit" disabled={submitting} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In & Accept Invite'}
                  </button>
                </form>
              ) : (
                // No account — show create account form only
                <form onSubmit={handleRegister} className="space-y-3">
                  <p className="text-xs text-slate-500 mb-4">Create an account for <span className="text-white font-bold">{invite.email}</span> to join.</p>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name"
                        className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500/50 transition-colors" />
                    </div>
                    <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name"
                      className="flex-1 px-3 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500/50 transition-colors" />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input type="email" value={email} readOnly
                      className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white/60 outline-none cursor-default" />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Create password (min 6 chars)" required minLength={6}
                      className="w-full pl-9 pr-10 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500/50 transition-colors" />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formError && <p className="text-red-400 text-xs">{formError}</p>}
                  <button type="submit" disabled={submitting} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account & Accept Invite'}
                  </button>
                </form>
              )}
            </div>
          </div>

        ) : (
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        )}
      </motion.div>
    </div>
  );
}
