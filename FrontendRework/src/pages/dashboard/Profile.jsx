import { useState, useRef, useEffect, useCallback } from 'react';
import {
  User, Mail, Briefcase, Globe, Clock, Camera, Edit3, Save, X,
  Sparkles, Download, Trophy, Star, Zap, Shield, ChevronRight,
  Calendar, MapPin, Link as LinkIcon, Twitter, Linkedin, Check,
  CreditCard, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, activityApi } from '../../lib/api';
import { GLASS_STYLE } from '../../components/ui/GlassCard';

const EVENT_TYPE_STYLES = {
  generation: { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', Icon: Sparkles },
  generate: { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', Icon: Sparkles },
  export: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', Icon: Download },
  brand_kit: { color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', Icon: Star },
  brand: { color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', Icon: Star },
  automation: { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', Icon: Zap },
  team: { color: 'text-pink-400 bg-pink-500/10 border-pink-500/20', Icon: User },
};
const DEFAULT_EVENT_STYLE = { color: 'text-gray-400 bg-gray-500/10 border-gray-500/20', Icon: Calendar };

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getInitials(firstName, lastName, email) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return 'U';
}

export default function Profile() {
  const { user, credits, refreshUser } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [avatarHovered, setAvatarHovered] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [activity, setActivity] = useState([]);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    bio: '',
    location: '',
    timezone: '',
    language: 'English',
    twitter: '',
    linkedin: '',
    website: '',
  });
  const [originalForm, setOriginalForm] = useState(null);

  const loadUserIntoForm = useCallback((u) => {
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email?.split('@')[0] || '';
    const data = {
      name,
      email: u.email || '',
      bio: u.bio || '',
      location: u.location || '',
      timezone: u.timezone || '',
      language: u.language || 'English',
      twitter: u.twitter || '',
      linkedin: u.linkedin || '',
      website: u.website || '',
    };
    setForm(data);
    setOriginalForm(data);
    if (u.avatar_url) setAvatarPreview(u.avatar_url);
  }, []);

  useEffect(() => {
    if (user) loadUserIntoForm(user);
  }, [user, loadUserIntoForm]);

  useEffect(() => {
    activityApi.events({ limit: 5 }).then(data => {
      const events = Array.isArray(data) ? data : (data?.results || []);
      setActivity(events.slice(0, 5));
    }).catch(() => {});
  }, []);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCancel = () => {
    if (originalForm) setForm(originalForm);
    if (user?.avatar_url) setAvatarPreview(user.avatar_url);
    else if (!avatarFile) setAvatarPreview(null);
    setAvatarFile(null);
    setIsEditing(false);
    setSaveError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const nameParts = form.name.trim().split(/\s+/);
      const first_name = nameParts[0] || '';
      const last_name = nameParts.slice(1).join(' ') || '';

      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        fd.append('first_name', first_name);
        fd.append('last_name', last_name);
        fd.append('bio', form.bio);
        fd.append('location', form.location);
        fd.append('timezone', form.timezone);
        fd.append('language', form.language);
        fd.append('twitter', form.twitter);
        fd.append('linkedin', form.linkedin);
        fd.append('website', form.website);
        await authApi.uploadAvatar(fd);
      } else {
        await authApi.updateMe({ first_name, last_name, bio: form.bio, location: form.location, timezone: form.timezone, language: form.language, twitter: form.twitter, linkedin: form.linkedin, website: form.website });
      }

      const updated = await refreshUser();
      if (updated) loadUserIntoForm(updated);
      setAvatarFile(null);
      setSaved(true);
      setIsEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const planName = (typeof credits?.plan === 'string' ? credits.plan : credits?.plan?.name) || 'Free Trial';
  const planTier = credits?.plan_tier || credits?.plan?.tier || 'free';
  const creditBalance = credits?.balance ?? 0;
  const creditUsed = credits?.used ?? 0;
  const creditTotal = creditBalance + creditUsed;
  const creditPct = creditTotal > 0 ? Math.round((creditUsed / creditTotal) * 100) : 0;

  const stats = [
    { label: 'Creatives Made', value: creditUsed.toLocaleString(), Icon: Sparkles, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Credits Left', value: creditBalance.toLocaleString(), Icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Plan', value: planName, Icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    { label: 'Member Since', value: user?.date_joined ? new Date(user.date_joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—', Icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  ];

  const initials = getInitials(user?.first_name, user?.last_name, user?.email);

  return (
    <div className="space-y-8 pb-20 text-left max-w-5xl flex flex-col mx-auto relative z-10">
      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-24 right-8 bg-emerald-500 text-white font-bold p-4 rounded-xl shadow-2xl z-50 flex items-center gap-3 border border-emerald-400"
          >
            <Check className="w-5 h-5 bg-white text-emerald-500 rounded-full p-0.5" />
            Profile saved successfully
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative p-8 border border-white/5 rounded-[2.5rem] overflow-hidden"
        style={{ background: 'linear-gradient(to right, var(--accent-muted), var(--bg-card))' }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative z-10">
          {/* Avatar */}
          <div
            className="relative group cursor-pointer shrink-0"
            onMouseEnter={() => setAvatarHovered(true)}
            onMouseLeave={() => setAvatarHovered(false)}
            onClick={() => isEditing && fileRef.current?.click()}
          >
            <motion.div
              whileHover={isEditing ? { scale: 1.05 } : {}}
              className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-blue-500/30 shadow-xl shadow-blue-500/10"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white text-3xl font-black"
                  style={{ background: 'linear-gradient(to bottom right, var(--accent), var(--accent-hover))' }}
                >
                  {initials}
                </div>
              )}
            </motion.div>
            {isEditing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: avatarHovered ? 1 : 0 }}
                className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center backdrop-blur-sm"
              >
                <Camera className="w-6 h-6 text-white" />
              </motion.div>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2" style={{ borderColor: 'var(--bg-card)' }} />
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white">{form.name || user?.email?.split('@')[0] || 'Your Name'}</h1>
              <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                {planName}
              </span>
            </div>
            <p className="text-gray-400 text-sm flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-blue-500" /> {user?.email}</p>
            {form.location && (
              <p className="text-gray-500 text-xs flex items-center gap-1.5 mt-1"><MapPin className="w-3.5 h-3.5" /> {form.location}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-3">
              {form.twitter && (
                <a href={form.twitter.startsWith('http') ? form.twitter : `https://twitter.com/${form.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-gray-500 hover:text-blue-400 transition-colors text-xs">
                  <Twitter className="w-3.5 h-3.5" /><span>{form.twitter}</span>
                </a>
              )}
              {form.linkedin && (
                <a href={form.linkedin.startsWith('http') ? form.linkedin : `https://${form.linkedin}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-gray-500 hover:text-blue-400 transition-colors text-xs">
                  <Linkedin className="w-3.5 h-3.5" /><span>{form.linkedin}</span>
                </a>
              )}
              {form.website && (
                <a href={form.website.startsWith('http') ? form.website : `https://${form.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-gray-500 hover:text-blue-400 transition-colors text-xs">
                  <LinkIcon className="w-3.5 h-3.5" /><span>{form.website}</span>
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-gray-400 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-700/6 hover:bg-blue-700/15 border border-white/5 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
              >
                <Edit3 className="w-4 h-4 text-blue-400" /> Edit Profile
              </button>
            )}
          </div>
        </div>

        {saveError && (
          <p className="mt-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{saveError}</p>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            style={GLASS_STYLE} className="p-5 rounded-2xl"
          >
            <div className={`w-9 h-9 rounded-xl border ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.Icon className={`w-4.5 h-4.5 ${stat.color}`} style={{ width: 18, height: 18 }} />
            </div>
            <p className="text-2xl font-black text-white truncate">{stat.value}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile form */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={GLASS_STYLE} className="lg:col-span-2 p-8 rounded-3xl space-y-6"
        >
          <h3 className="text-sm font-extrabold uppercase tracking-widest text-white flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" /> Profile Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Full Name', key: 'name', icon: User },
              { label: 'Email Address', key: 'email', icon: Mail, readOnly: true },
              { label: 'Location', key: 'location', icon: MapPin },
              { label: 'Timezone', key: 'timezone', icon: Clock },
              { label: 'Language', key: 'language', icon: Globe },
            ].map((field) => (
              <div key={field.key} className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{field.label}</label>
                {isEditing && !field.readOnly ? (
                  <div className="relative">
                    <field.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input
                      value={form[field.key]}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      className="w-full bg-black border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-300 font-medium py-2.5 px-3 bg-black/40 border border-white/5 rounded-xl flex items-center gap-2">
                    <field.icon className="w-4 h-4 text-gray-600 shrink-0" />
                    <span className="truncate">{form[field.key] || <span className="text-gray-600 italic">Not set</span>}</span>
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Bio</label>
            {isEditing ? (
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={4}
                placeholder="Tell us about yourself..."
                className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-700 focus:border-blue-500 outline-none transition-all resize-none leading-relaxed"
              />
            ) : (
              <p className="text-sm text-gray-400 leading-relaxed p-3 bg-black/40 border border-white/5 rounded-xl min-h-20">
                {form.bio || <span className="text-gray-600 italic">No bio yet.</span>}
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-white/5 space-y-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Social & Links</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Twitter / X', key: 'twitter', icon: Twitter },
                { label: 'LinkedIn', key: 'linkedin', icon: Linkedin },
                { label: 'Website', key: 'website', icon: LinkIcon },
              ].map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{field.label}</label>
                  {isEditing ? (
                    <div className="relative">
                      <field.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                      <input
                        value={form[field.key]}
                        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                        placeholder="—"
                        className="w-full bg-black border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-gray-700 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs py-2 pl-2">
                      <field.icon className="w-3.5 h-3.5 shrink-0 text-gray-600" />
                      {form[field.key] ? (
                        <a href={form[field.key].startsWith('http') ? form[field.key] : `https://${form[field.key]}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">
                          {form[field.key]}
                        </a>
                      ) : (
                        <span className="text-gray-600 italic">Not set</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Right column */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            style={GLASS_STYLE} className="p-6 rounded-3xl space-y-4"
          >
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-white flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-blue-500" /> Recent Activity
            </h3>
            {activity.length === 0 ? (
              <p className="text-xs text-gray-600 italic">No recent activity yet.</p>
            ) : (
              <div className="space-y-3">
                {activity.map((item, i) => {
                  const style = EVENT_TYPE_STYLES[item.event_type] || DEFAULT_EVENT_STYLE;
                  return (
                    <motion.div
                      key={item.id || i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.06 }}
                      className="flex items-start gap-3"
                    >
                      <div className={`p-1.5 rounded-lg border ${style.color} shrink-0 mt-0.5`}>
                        <style.Icon className="w-3 h-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">{item.action || item.description}</p>
                        {item.metadata?.campaign && (
                          <p className="text-[10px] text-gray-500 truncate">{item.metadata.campaign}</p>
                        )}
                      </div>
                      <span className="text-[9px] text-gray-600 shrink-0 mt-0.5">{timeAgo(item.created_at)}</span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.section>

          {/* Current Plan */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 border border-blue-500/15 rounded-3xl space-y-4"
            style={{ background: 'linear-gradient(to bottom right, var(--accent-muted), var(--bg-raised))' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-white flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-blue-500" /> Current Plan
              </h3>
              <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                {planName}
              </span>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-400 font-medium">Credits Used</span>
                <span className="text-white font-bold">{creditUsed} / {creditTotal}</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${creditPct}%` }}
                  transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
                  className={`h-full rounded-full ${creditPct > 80 ? 'bg-linear-to-r from-red-600 to-red-400' : ''}`}
                  style={creditPct > 80 ? undefined : { background: 'linear-gradient(to right, var(--accent-hover), var(--accent))' }}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-2">{creditBalance} credits remaining</p>
            </div>
            <div className="pt-2">
              <Link
                to="/dashboard/workspace?tab=billing"
                className="w-full py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/20 text-blue-400 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                Upgrade Plan <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
