import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, UserPlus, Key, Copy, Plus, Shield,
  ChevronRight, MoreHorizontal, Mail, Check, X, Trash2,
  Crown, Eye, Edit3, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { teamApi } from '../../lib/api';
import LockedFeature from '../../components/dashboard/LockedFeature';

const roleColors = {
  owner: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  admin: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  editor: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  analyst: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
};

const roleIcons = { admin: Crown, owner: Crown };

function MemberRow({ member, i, onRemove, canRemove }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const user = member.user || member;
  const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Member';
  const initials = displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '??';
  const role = (member.role || 'analyst').toLowerCase();
  const RoleIcon = roleIcons[role];
  const roleColor = roleColors[role] || 'bg-slate-500/10 border-slate-500/20 text-slate-400';

  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.07 }}
      className="border-b border-white/5 hover:bg-white/2 transition-all group relative"
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-600 to-blue-800 flex items-center justify-center font-black text-xs text-white shrink-0 shadow-sm shadow-blue-600/20">
            {initials}
          </div>
          <div>
            <p className="text-sm font-bold text-white">{displayName}</p>
            <p className="text-[10px] text-slate-600">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${roleColor}`}>
          {RoleIcon && <RoleIcon className="w-2.5 h-2.5" />}
          {member.role || 'analyst'}
        </div>
      </td>
      <td className="px-6 py-4 hidden sm:table-cell">
        <div className="flex items-center gap-1.5">
          <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }} className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-slate-600">Active</span>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="relative inline-block">
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 text-slate-700 hover:text-white hover:bg-white/6 rounded-lg transition-all opacity-60 group-hover:opacity-100">
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                className="absolute right-0 top-full mt-1 w-40 bg-[#0c0f1a] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden"
                onMouseLeave={() => setMenuOpen(false)}
              >
                {[
                  { label: 'Edit Role', icon: Edit3 },
                  { label: 'Send Message', icon: Mail },
                ].map((item) => (
                  <button key={item.label} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[11px] font-bold transition-all text-slate-500 hover:text-white hover:bg-white/4">
                    <item.icon className="w-3 h-3" /> {item.label}
                  </button>
                ))}
                {canRemove && member.role !== 'owner' && (
                  <button onClick={() => { onRemove(member.id); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[11px] font-bold transition-all text-slate-500 hover:text-red-400 hover:bg-red-500/5">
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </td>
    </motion.tr>
  );
}

function ApiKey({ keyData, onDelete, canDelete }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(keyData.key || keyData.key_preview || '').catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const createdDate = keyData.created_at ? new Date(keyData.created_at).toLocaleDateString() : keyData.created || '—';

  return (
    <div className="p-4 bg-white/3 border border-white/6 rounded-xl group hover:border-white/10 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-black text-white">{keyData.name}</p>
          <p className="text-[9px] text-slate-700 font-mono mt-0.5">Created {createdDate}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          {canDelete && (
            <button onClick={onDelete} className="p-1 text-slate-700 hover:text-red-400 transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/12 rounded-lg px-3 py-2">
        <span className="flex-1 font-mono text-[10px] text-blue-400 truncate">{keyData.key || keyData.key_preview || '••••••••••••'}</span>
        <button onClick={handleCopy} className="shrink-0 text-slate-600 hover:text-white transition-colors">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function TeamWorkspacePage() {
  const { activeWorkspace, isAdmin } = useAuth();
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      const [membersRes, invitesRes, keysRes] = await Promise.allSettled([
        teamApi.members(),
        teamApi.invites(),
        teamApi.apiKeys(),
      ]);
      if (membersRes.status === 'fulfilled') setMembers(membersRes.value?.results || membersRes.value || []);
      if (invitesRes.status === 'fulfilled') setInvites(invitesRes.value?.results || invitesRes.value || []);
      if (keysRes.status === 'fulfilled') setApiKeys(keysRes.value?.results || keysRes.value || []);
      setLoading(false);
    })();
  }, [activeWorkspace]);

  const createKey = async () => {
    try {
      const key = await teamApi.createApiKey(`API Key ${apiKeys.length + 1}`);
      setApiKeys((prev) => [...prev, key]);
    } catch (_) {}
  };

  const deleteKey = async (id) => {
    try {
      await teamApi.deleteApiKey(id);
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (_) {}
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const invite = await teamApi.invite(inviteEmail.trim(), inviteRole);
      setInvites((prev) => [...prev, invite]);
      setInviteEmail('');
      setShowInvite(false);
    } catch (_) {}
    setInviting(false);
  };

  const removeMember = async (id) => {
    try {
      await teamApi.removeMember(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch (_) {}
  };

  const cancelInvite = async (id) => {
    try {
      await teamApi.cancelInvite(id);
      setInvites((prev) => prev.filter((i) => i.id !== id));
    } catch (_) {}
  };

  const seatCount = members.length;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Team Workspace</h1>
          <p className="text-slate-500 text-sm mt-1">Manage members, roles, and API access for your workspace</p>
        </div>
        {isAdmin && (
          <motion.button
            onClick={() => setShowInvite(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20"
          >
            <UserPlus className="w-4 h-4" /> Invite Member
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {showInvite && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-5 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-black text-white text-sm">Invite Team Member</h4>
              <button onClick={() => setShowInvite(false)} className="text-slate-600 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-xl py-3 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-slate-700"
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="bg-[#0c0f1a] border border-white/8 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all appearance-none min-w-32"
              >
                {['admin', 'editor', 'analyst'].map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
              <button onClick={handleInvite} disabled={inviting} className="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 text-white rounded-xl font-black text-sm transition-all flex items-center gap-2 shrink-0">
                <Mail className="w-4 h-4" /> {inviting ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0b0e1a] border border-white/6 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-slate-500" />
              <h3 className="font-black text-white text-sm">Active Members</h3>
            </div>
            <span className="text-[10px] font-black text-slate-600 bg-white/4 border border-white/6 px-2.5 py-1 rounded-lg">
              {seatCount} / 10 seats
            </span>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1,2,3].map((i) => <div key={i} className="h-14 bg-white/3 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-6 py-3 text-[10px] font-black text-slate-600 uppercase tracking-widest text-left">Member</th>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-600 uppercase tracking-widest text-left">Role</th>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-600 uppercase tracking-widest text-left hidden sm:table-cell">Status</th>
                    <th className="px-6 py-3 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, i) => (
                    <MemberRow key={member.id} member={member} i={i} onRemove={removeMember} canRemove={isAdmin} />
                  ))}
                  {members.length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-[11px] text-slate-700">No team members found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-4 border-t border-white/5">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-2">
              <span>Seat Usage</span>
              <span>{seatCount} / 10</span>
            </div>
            <div className="w-full h-1.5 bg-white/4 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(seatCount / 10) * 100}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-blue-500 rounded-full"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Pending Invites */}
          <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-5">
            <h4 className="font-black text-white text-sm mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-500" />
              Pending Invites
            </h4>
            {invites.filter((inv) => inv.status === 'pending' || !inv.status).length === 0 ? (
              <div className="p-4 bg-white/2 border border-white/5 rounded-xl text-center">
                <p className="text-[11px] text-slate-700">No active pending invitations</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invites.filter((inv) => inv.status === 'pending' || !inv.status).map((inv) => (
                  <div key={inv.id} className="flex items-center gap-2 p-3 bg-white/3 border border-white/6 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{inv.email}</p>
                      <p className="text-[9px] text-slate-600 capitalize">{inv.role}</p>
                    </div>
                    {isAdmin && (
                      <button onClick={() => cancelInvite(inv.id)} className="p-1 text-slate-700 hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* API Keys */}
          <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-white text-sm flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" /> API Keys
              </h4>
              {isAdmin && (
                <motion.button onClick={createKey} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="p-1.5 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 text-blue-400 rounded-lg transition-all">
                  <Plus className="w-3.5 h-3.5" />
                </motion.button>
              )}
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1,2].map((i) => <div key={i} className="h-20 bg-white/3 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((k) => <ApiKey key={k.id} keyData={k} onDelete={() => deleteKey(k.id)} canDelete={isAdmin} />)}
                {apiKeys.length === 0 && <p className="text-[11px] text-slate-700 text-center py-4">No API keys yet</p>}
              </div>
            )}
            <div className="p-3 bg-amber-500/4 border border-amber-500/12 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-700 leading-relaxed">API access is restricted to whitelisted IPs. Manage in Settings.</p>
            </div>
          </div>

          {/* Permissions legend */}
          <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-5">
            <h4 className="font-black text-white text-sm mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-500" /> Role Permissions
            </h4>
            <div className="space-y-2">
              {Object.entries(roleColors).slice(0, 5).map(([role, color]) => (
                <div key={role} className="flex items-center gap-2.5">
                  <div className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase ${color}`}>{role}</div>
                  <ChevronRight className="w-3 h-3 text-slate-800" />
                  <span className="text-[10px] text-slate-700">
                    {role === 'admin' || role === 'owner' ? 'Full access' : role === 'editor' ? 'Generate & view' : 'View & export only'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeamWorkspace() {
  const { isFreeTier, isIndividualTier } = useAuth();
  if (isFreeTier || isIndividualTier) return <LockedFeature feature="Team & Workspace" />;
  return <TeamWorkspacePage />;
}
