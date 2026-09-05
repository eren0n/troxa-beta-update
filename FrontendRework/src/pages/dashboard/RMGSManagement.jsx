import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Users, Building2, CreditCard, ChevronDown, ChevronRight,
  Plus, X, Check, Loader2, Edit2, RefreshCw, AlertTriangle, BarChart2,
  Database, Crown, UserCog, Trash2, UserPlus,
} from 'lucide-react';
import { mgmtApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { GLASS_STYLE } from '../../components/ui/GlassCard';

const PLAN_TIERS = ['free', 'individual', 'team', 'enterprise'];

const PLAN_COLORS = {
  free: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  individual: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  team: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  enterprise: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

const TAB_LABELS = {
  meta: 'Meta Ads',
  workspaces: 'Workspaces',
  users: 'Users',
  plans: 'Plans',
  'data-users': 'Data Users',
};

function Badge({ tier }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${PLAN_COLORS[tier] || PLAN_COLORS.free}`}>
      {tier}
    </span>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div style={GLASS_STYLE} className="rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
        <Icon className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-black text-white">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

const INPUT = 'bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none transition-all placeholder:text-slate-700';

// ──────────────────────────────────────────────
// Users Tab
// ──────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setUsers(await mgmtApi.users()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    setSaving(true); setError(null);
    try {
      const u = await mgmtApi.createUser(form);
      setUsers(prev => [u, ...prev]);
      setShowAdd(false);
      setForm({ email: '', password: '', first_name: '', last_name: '' });
    } catch (e) {
      setError(e?.data?.error || 'Failed to create user');
    } finally { setSaving(false); }
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setEditForm({ first_name: u.first_name, last_name: u.last_name, email: u.email, is_active: u.is_active, password: '' });
    setEditError(null);
  };

  const cancelEdit = () => { setEditingId(null); setEditError(null); };

  const saveEdit = async (id) => {
    setEditSaving(true); setEditError(null);
    try {
      const payload = { ...editForm };
      if (!payload.password) delete payload.password;
      const updated = await mgmtApi.updateUser(id, payload);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u));
      setEditingId(null);
    } catch (e) {
      setEditError(e?.data?.error || 'Failed to update');
    } finally { setEditSaving(false); }
  };

  return (
    <Section title={`Users (${users.length})`} icon={Users}>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all">
          <Plus className="w-3.5 h-3.5" /> Add User
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
            <div className="p-4 bg-blue-500/5 border border-blue-500/15 rounded-xl space-y-3">
              <p className="text-xs font-black text-blue-400 uppercase tracking-widest">New User</p>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} placeholder="First Name" className={INPUT} />
                <input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} placeholder="Last Name" className={INPUT} />
                <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="Email" type="email" className={INPUT} />
                <input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Password" type="password" className={INPUT} />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Create
                </button>
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-white/5 border border-white/8 text-slate-400 text-xs font-black rounded-xl hover:text-white transition-all">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-slate-500 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Email', 'Name', 'Workspaces', 'Joined', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-[10px] font-black text-slate-600 uppercase tracking-widest pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <>
                  <tr key={u.id} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                    <td className="py-3 pr-4 text-sm text-white font-mono">{u.email}</td>
                    <td className="py-3 pr-4 text-sm text-slate-400">{u.full_name}</td>
                    <td className="py-3 pr-4 text-sm text-slate-400">{u.ws_count}</td>
                    <td className="py-3 pr-4 text-xs text-slate-600">{new Date(u.date_joined).toLocaleDateString()}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${u.is_active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button onClick={() => editingId === u.id ? cancelEdit() : startEdit(u)} className="p-1.5 text-slate-500 hover:text-blue-400 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                  <AnimatePresence>
                    {editingId === u.id && (
                      <tr key={`edit-${u.id}`}>
                        <td colSpan={6} className="p-0">
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <div className="px-4 py-4 bg-blue-500/4 border-b border-blue-500/15 space-y-3">
                              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Edit User</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <input value={editForm.first_name} onChange={e => setEditForm(p => ({ ...p, first_name: e.target.value }))} placeholder="First Name" className={INPUT + ' text-xs'} />
                                <input value={editForm.last_name} onChange={e => setEditForm(p => ({ ...p, last_name: e.target.value }))} placeholder="Last Name" className={INPUT + ' text-xs'} />
                                <input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} placeholder="Email" type="email" className={INPUT + ' text-xs'} />
                                <input value={editForm.password} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} placeholder="New Password (optional)" type="password" className={INPUT + ' text-xs'} />
                              </div>
                              <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input type="checkbox" checked={editForm.is_active} onChange={e => setEditForm(p => ({ ...p, is_active: e.target.checked }))} className="accent-blue-500" />
                                  <span className="text-xs text-slate-400">Active</span>
                                </label>
                              </div>
                              {editError && <p className="text-xs text-red-400">{editError}</p>}
                              <div className="flex gap-2">
                                <button onClick={() => saveEdit(u.id)} disabled={editSaving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all">
                                  {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                                </button>
                                <button onClick={cancelEdit} className="px-4 py-2 bg-white/5 border border-white/8 text-slate-400 text-xs font-black rounded-xl hover:text-white transition-all">Cancel</button>
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ──────────────────────────────────────────────
// Workspace Row (expandable)
// ──────────────────────────────────────────────

function WorkspaceRow({ ws, plans, onUpdated }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editCredits, setEditCredits] = useState(false);
  const [creditInput, setCreditInput] = useState(String(ws.credit_bonus ?? 0));
  const [savingCredits, setSavingCredits] = useState(false);
  const [editPlan, setEditPlan] = useState(false);
  const [planInput, setPlanInput] = useState(ws.plan_tier);
  const [savingPlan, setSavingPlan] = useState(false);
  const [editCode, setEditCode] = useState(false);
  const [codeInput, setCodeInput] = useState(ws.code || '');
  const [savingCode, setSavingCode] = useState(false);
  const [codeError, setCodeError] = useState(null);
  // Member management
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('editor');
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const toggle = async () => {
    setExpanded(e => !e);
    if (!detail && !loadingDetail) {
      setLoadingDetail(true);
      try { setDetail(await mgmtApi.workspaceDetail(ws.id)); } finally { setLoadingDetail(false); }
    }
  };

  const saveCredits = async () => {
    setSavingCredits(true);
    try {
      const updated = await mgmtApi.updateCredits(ws.id, parseInt(creditInput));
      onUpdated(ws.id, { credit_bonus: updated.credit_bonus, monthly_usage: updated.monthly_usage, credits_available: updated.credits_available });
      setEditCredits(false);
    } finally { setSavingCredits(false); }
  };

  const savePlan = async () => {
    setSavingPlan(true);
    try {
      const updated = await mgmtApi.updateWorkspacePlan(ws.id, planInput);
      onUpdated(ws.id, { plan_name: updated.plan_name, plan_tier: updated.plan_tier });
      setEditPlan(false);
    } finally { setSavingPlan(false); }
  };

  const saveCode = async () => {
    const trimmed = codeInput.trim().toUpperCase();
    if (!trimmed) { setCodeError('Code cannot be empty'); return; }
    if (trimmed.length > 8) { setCodeError('Max 8 characters'); return; }
    if (!/^[A-Z0-9]+$/.test(trimmed)) { setCodeError('Letters and numbers only'); return; }
    setSavingCode(true); setCodeError(null);
    try {
      const updated = await mgmtApi.updateWorkspaceCode(ws.id, trimmed);
      onUpdated(ws.id, { code: updated.code });
      setCodeInput(updated.code);
      setEditCode(false);
    } catch (e) {
      setCodeError(e?.data?.error || 'Save failed');
    } finally { setSavingCode(false); }
  };

  const addMember = async () => {
    if (!memberEmail.trim()) return;
    setAddingMember(true); setMemberError(null);
    try {
      const m = await mgmtApi.addWorkspaceMember(ws.id, memberEmail.trim(), memberRole);
      setDetail(prev => prev ? { ...prev, members: [...prev.members, m] } : prev);
      onUpdated(ws.id, { member_count: ws.member_count + 1 });
      setMemberEmail(''); setShowAddMember(false);
    } catch (e) {
      setMemberError(e?.data?.error || 'Failed to add member');
    } finally { setAddingMember(false); }
  };

  const removeMember = async (memberId) => {
    setRemovingId(memberId);
    try {
      await mgmtApi.removeWorkspaceMember(ws.id, memberId);
      setDetail(prev => prev ? { ...prev, members: prev.members.filter(m => m.id !== memberId) } : prev);
      onUpdated(ws.id, { member_count: Math.max(0, ws.member_count - 1) });
    } catch (_) {}
    setRemovingId(null);
  };

  return (
    <>
      <tr className="border-b border-white/4 hover:bg-white/2 transition-colors cursor-pointer" onClick={toggle}>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
            <span className="text-sm text-white font-medium">{ws.name}</span>
          </div>
        </td>
        <td className="py-3 pr-4 text-xs text-slate-500 font-mono">{ws.owner_email}</td>
        <td className="py-3 pr-4"><Badge tier={ws.plan_tier} /></td>
        <td className="py-3 pr-4 text-sm font-bold">
          {ws.unlimited_usage
            ? <span className="text-emerald-400">∞</span>
            : <span className="text-white">{ws.monthly_usage}<span className="text-slate-600 font-normal text-xs"> / {ws.monthly_credits + (ws.credit_bonus || 0)}</span></span>
          }
        </td>
        <td className="py-3 pr-4 text-sm text-slate-400">{ws.member_count}</td>
        <td className="py-3 text-xs text-slate-600">{new Date(ws.created_at).toLocaleDateString()}</td>
      </tr>

      <AnimatePresence>
        {expanded && (
          <tr>
            <td colSpan={6} className="p-0">
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="bg-white/2 border-b border-white/5 px-8 py-5 space-y-5">
                  {/* Actions row */}
                  <div className="flex flex-wrap gap-3">
                    {editCredits ? (
                      <div className="flex items-center gap-2">
                        <input type="number" value={creditInput} onChange={e => setCreditInput(e.target.value)} className="w-28 bg-black/40 border border-blue-500/40 rounded-xl px-3 py-1.5 text-sm text-white outline-none" onClick={e => e.stopPropagation()} />
                        <button onClick={(e) => { e.stopPropagation(); saveCredits(); }} disabled={savingCredits} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all">
                          {savingCredits ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setEditCredits(false); }} className="px-3 py-1.5 bg-white/5 border border-white/8 text-slate-400 text-xs font-black rounded-xl">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setCreditInput(String(ws.credit_bonus ?? 0)); setEditCredits(true); }} className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black rounded-xl hover:bg-blue-500/20 transition-all">
                        <CreditCard className="w-3.5 h-3.5" /> Credit Override ({ws.credit_bonus ?? 0})
                      </button>
                    )}

                    {editPlan ? (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <select value={planInput} onChange={e => setPlanInput(e.target.value)} className="bg-black/40 border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] rounded-xl px-3 py-1.5 text-sm text-white outline-none cursor-pointer">
                          {PLAN_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button onClick={savePlan} disabled={savingPlan} className="flex items-center gap-1.5 px-3 py-1.5 bg-(--accent) hover:bg-(--accent-hover) disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all">
                          {savingPlan ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                        </button>
                        <button onClick={() => setEditPlan(false)} className="px-3 py-1.5 bg-white/5 border border-white/8 text-slate-400 text-xs font-black rounded-xl">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setPlanInput(ws.plan_tier); setEditPlan(true); }} className="flex items-center gap-2 px-3 py-1.5 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-(--accent) text-xs font-black rounded-xl hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] transition-all">
                        <Edit2 className="w-3.5 h-3.5" /> Change Plan ({ws.plan_name})
                      </button>
                    )}

                    {editCode ? (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            value={codeInput}
                            onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError(null); }}
                            maxLength={8}
                            placeholder="e.g. ES"
                            className="w-24 bg-black/40 border border-emerald-500/40 rounded-xl px-3 py-1.5 text-sm text-white font-mono outline-none uppercase"
                          />
                          {codeError && <span className="text-[10px] text-red-400">{codeError}</span>}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); saveCode(); }} disabled={savingCode} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all">
                          {savingCode ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setEditCode(false); setCodeError(null); }} className="px-3 py-1.5 bg-white/5 border border-white/8 text-slate-400 text-xs font-black rounded-xl">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setCodeInput(ws.code || ''); setEditCode(true); }} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black rounded-xl hover:bg-emerald-500/20 transition-all">
                        <Edit2 className="w-3.5 h-3.5" /> Naming Convention ({ws.code || (() => { const words = ws.name.trim().split(/\s+/); return words.length === 1 ? ws.name.slice(0, 2).toUpperCase() : words.map(w => w[0]).join('').slice(0, 4).toUpperCase(); })()})
                      </button>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Jobs Created', value: ws.job_count },
                      { label: 'Creatives', value: ws.creative_count },
                      { label: 'Members', value: ws.member_count },
                    ].map(s => (
                      <div key={s.label} className="bg-black/30 border border-white/5 rounded-xl px-4 py-3">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">{s.label}</p>
                        <p className="text-xl font-black text-white">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {loadingDetail ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 text-slate-500 animate-spin" /></div>
                  ) : detail && (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Members */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Members</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowAddMember(v => !v); setMemberError(null); }}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-lg hover:bg-emerald-500/20 transition-all"
                          >
                            <UserPlus className="w-3 h-3" /> Add
                          </button>
                        </div>

                        <AnimatePresence>
                          {showAddMember && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-2">
                              <div className="p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl space-y-2" onClick={e => e.stopPropagation()}>
                                <input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="user@email.com" className="w-full bg-black/40 border border-white/8 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-white outline-none placeholder:text-slate-700" />
                                <div className="flex gap-2">
                                  <select value={memberRole} onChange={e => setMemberRole(e.target.value)} className="bg-black/40 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white outline-none cursor-pointer">
                                    {['admin', 'editor', 'analyst'].map(r => <option key={r} value={r}>{r}</option>)}
                                  </select>
                                  <button onClick={addMember} disabled={addingMember} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black rounded-lg transition-all">
                                    {addingMember ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Add
                                  </button>
                                  <button onClick={() => setShowAddMember(false)} className="px-2 py-1.5 text-slate-500 hover:text-white text-xs transition-colors">Cancel</button>
                                </div>
                                {memberError && <p className="text-[10px] text-red-400">{memberError}</p>}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="space-y-1.5">
                          {detail.members.map(m => (
                            <div key={m.id} className="flex items-center justify-between px-3 py-2 bg-black/20 border border-white/4 rounded-xl group">
                              <div>
                                <p className="text-xs text-white">{m.email}</p>
                                <p className="text-[10px] text-slate-600">{m.full_name}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase">{m.role}</span>
                                {m.role !== 'owner' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeMember(m.id); }}
                                    disabled={removingId === m.id}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-700 hover:text-red-400 transition-all"
                                  >
                                    {removingId === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recent Jobs */}
                      <div>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Recent Jobs</p>
                        <div className="space-y-1.5">
                          {detail.recent_jobs.map(j => (
                            <div key={j.id} className="flex items-center justify-between px-3 py-2 bg-black/20 border border-white/4 rounded-xl">
                              <div>
                                <p className="text-xs text-white truncate max-w-35">{j.model_name}</p>
                                <p className="text-[10px] text-slate-600">{new Date(j.created_at).toLocaleDateString()}</p>
                              </div>
                              <span className={`text-[10px] font-black uppercase ${j.status === 'done' ? 'text-emerald-400' : j.status === 'error' ? 'text-red-400' : 'text-blue-400'}`}>{j.status}</span>
                            </div>
                          ))}
                          {detail.recent_jobs.length === 0 && <p className="text-xs text-slate-600">No jobs yet</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ──────────────────────────────────────────────
// Workspaces Tab
// ──────────────────────────────────────────────

function WorkspacesTab({ plans }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', owner_email: '', plan_tier: 'free' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setWorkspaces(await mgmtApi.workspaces()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    setSaving(true); setError(null);
    try {
      const ws = await mgmtApi.createWorkspace(form);
      setWorkspaces(prev => [ws, ...prev]);
      setShowAdd(false);
      setForm({ name: '', owner_email: '', plan_tier: 'free' });
    } catch (e) {
      setError(e?.data?.error || 'Failed to create workspace');
    } finally { setSaving(false); }
  };

  const handleUpdated = (id, patch) => {
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));
  };

  return (
    <Section title={`Workspaces (${workspaces.length})`} icon={Building2}>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all">
          <Plus className="w-3.5 h-3.5" /> Create Workspace
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
            <div className="p-4 bg-blue-500/5 border border-blue-500/15 rounded-xl space-y-3">
              <p className="text-xs font-black text-blue-400 uppercase tracking-widest">New Workspace</p>
              <div className="grid grid-cols-3 gap-3">
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Workspace Name" className={INPUT} />
                <input value={form.owner_email} onChange={e => setForm(p => ({ ...p, owner_email: e.target.value }))} placeholder="Owner Email" className={INPUT} />
                <select value={form.plan_tier} onChange={e => setForm(p => ({ ...p, plan_tier: e.target.value }))} className="bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none cursor-pointer">
                  {PLAN_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Create
                </button>
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-white/5 border border-white/8 text-slate-400 text-xs font-black rounded-xl hover:text-white transition-all">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-slate-500 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Workspace', 'Owner', 'Plan', 'Credits', 'Members', 'Created'].map(h => (
                  <th key={h} className="text-left text-[10px] font-black text-slate-600 uppercase tracking-widest pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workspaces.map(ws => (
                <WorkspaceRow key={ws.id} ws={ws} plans={plans} onUpdated={handleUpdated} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ──────────────────────────────────────────────
// Plans Tab (unchanged)
// ──────────────────────────────────────────────

const EMPTY_PLAN = { name: '', tier: 'free', monthly_credits: 0, member_limit: 1, price_monthly: '0.00', features: [], is_active: true };
const PLAN_TIERS_OPTIONS = ['free', 'individual', 'team', 'enterprise'];
const ALL_FEATURES = [
  { key: 'fingerprint',    label: 'Brand Fingerprint' },
  { key: 'campaign_intel', label: 'Campaign Intel' },
  { key: 'prompt_studio',  label: 'Prompt Studio' },
  { key: 'slack',          label: 'Slack Integration' },
  { key: 'meta',           label: 'Meta Ads' },
];

function FeaturePicker({ value, onChange }) {
  const toggle = (key) => {
    onChange(value.includes(key) ? value.filter(f => f !== key) : [...value, key]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_FEATURES.map(f => (
        <button key={f.key} type="button" onClick={() => toggle(f.key)}
          className={`text-[10px] font-black px-2.5 py-1 rounded-full border transition-all ${value.includes(f.key) ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/4 border-white/8 text-slate-500 hover:text-slate-300'}`}>
          {value.includes(f.key) ? '✓ ' : ''}{f.label}
        </button>
      ))}
    </div>
  );
}

function PlansTab() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_PLAN);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setPlans(await mgmtApi.plans()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (plan) => {
    setEditing(plan.id);
    setForm({ ...plan, features: plan.features || [] });
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await mgmtApi.updatePlan(editing, {
        name: form.name,
        monthly_credits: parseInt(form.monthly_credits),
        member_limit: parseInt(form.member_limit),
        price_monthly: form.price_monthly,
        is_active: form.is_active,
        features: form.features || [],
      });
      setPlans(prev => prev.map(p => p.id === editing ? updated : p));
      setEditing(null);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this plan? Workspaces on this plan will keep their subscription but the plan will no longer be assignable.')) return;
    setDeleting(id);
    try {
      await mgmtApi.deletePlan(id);
      setPlans(prev => prev.filter(p => p.id !== id));
    } finally { setDeleting(null); }
  };

  const handleCreate = async () => {
    setCreating(true); setCreateError(null);
    try {
      const created = await mgmtApi.createPlan({
        ...newForm,
        monthly_credits: parseInt(newForm.monthly_credits),
        member_limit: parseInt(newForm.member_limit),
        features: newForm.features || [],
      });
      setPlans(prev => [...prev, created]);
      setShowAdd(false);
      setNewForm(EMPTY_PLAN);
    } catch (e) {
      setCreateError(e?.data?.error || 'Failed to create plan');
    } finally { setCreating(false); }
  };

  return (
    <Section title={`Plans (${plans.length})`} icon={CreditCard}>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all">
          <Plus className="w-3.5 h-3.5" /> New Plan
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-5 overflow-hidden">
            <div className="p-5 bg-blue-500/5 border border-blue-500/15 rounded-2xl space-y-4">
              <p className="text-xs font-black text-blue-400 uppercase tracking-widest">New Plan</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Plan Name</p>
                  <input type="text" value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Pro" className={INPUT + ' w-full'} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Tier</p>
                  <select value={newForm.tier} onChange={e => setNewForm(p => ({ ...p, tier: e.target.value }))} className="w-full bg-black/40 border border-white/8 rounded-xl px-3 py-2 text-sm text-white outline-none cursor-pointer">
                    {PLAN_TIERS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {[['Monthly Credits', 'monthly_credits', 'number'], ['Member Limit', 'member_limit', 'number'], ['Price / Month ($)', 'price_monthly', 'number']].map(([label, field, type]) => (
                  <div key={field}>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">{label}</p>
                    <input type={type} step={field === 'price_monthly' ? '0.01' : undefined} value={newForm[field]} onChange={e => setNewForm(p => ({ ...p, [field]: e.target.value }))} className={INPUT + ' w-full'} />
                  </div>
                ))}
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Status</p>
                  <select value={newForm.is_active} onChange={e => setNewForm(p => ({ ...p, is_active: e.target.value === 'true' }))} className="w-full bg-black/40 border border-white/8 rounded-xl px-3 py-2 text-sm text-white outline-none cursor-pointer">
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Features</p>
                  <FeaturePicker value={newForm.features} onChange={v => setNewForm(p => ({ ...p, features: v }))} />
                </div>
              </div>
              {createError && <p className="text-xs text-red-400">{createError}</p>}
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={creating} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all">
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Create Plan
                </button>
                <button onClick={() => { setShowAdd(false); setCreateError(null); }} className="px-4 py-2 bg-white/5 border border-white/8 text-slate-400 text-xs font-black rounded-xl hover:text-white transition-all">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-slate-500 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map(plan => (
            <div key={plan.id} className="bg-black/30 border border-white/6 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge tier={plan.tier} />
                  {editing === plan.id ? (
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-1 text-sm text-white outline-none w-32" />
                  ) : (
                    <span className="text-sm font-black text-white">{plan.name}</span>
                  )}
                </div>
                {editing === plan.id ? (
                  <div className="flex gap-2">
                    <button onClick={save} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                    </button>
                    <button onClick={() => setEditing(null)} className="p-1.5 text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(plan)} className="p-1.5 text-slate-500 hover:text-white transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(plan.id)} disabled={deleting === plan.id} className="p-1.5 text-slate-600 hover:text-red-400 disabled:opacity-50 transition-colors">
                      {deleting === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Monthly Credits', field: 'monthly_credits', suffix: 'cr' },
                  { label: 'Member Limit', field: 'member_limit', suffix: 'users' },
                  { label: 'Price / Month', field: 'price_monthly', prefix: '$' },
                ].map(({ label, field, suffix, prefix }) => (
                  <div key={field}>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">{label}</p>
                    {editing === plan.id ? (
                      <input type="number" value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} className="w-full bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-1.5 text-sm text-white outline-none" />
                    ) : (
                      <p className="text-sm font-bold text-white">{prefix}{plan[field]}{suffix ? ` ${suffix}` : ''}</p>
                    )}
                  </div>
                ))}
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Status</p>
                  {editing === plan.id ? (
                    <select value={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))} className="w-full bg-black/40 border border-white/8 rounded-xl px-3 py-1.5 text-sm text-white outline-none cursor-pointer">
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  ) : (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${plan.is_active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </div>
              </div>
              {editing === plan.id ? (
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Features</p>
                  <FeaturePicker value={form.features || []} onChange={v => setForm(p => ({ ...p, features: v }))} />
                </div>
              ) : plan.features?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Features</p>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.features.map((f, i) => (
                      <span key={i} className="text-[10px] text-slate-400 bg-white/4 border border-white/6 px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ──────────────────────────────────────────────
// Meta Ads Tab
// ──────────────────────────────────────────────

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7d', label: 'Last 7 days' },
  { value: 'last_14d', label: 'Last 14 days' },
  { value: 'last_30d', label: 'Last 30 days' },
  { value: 'last_90d', label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
];

const STATUS_COLORS = {
  ACTIVE: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  PAUSED: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  DELETED: 'text-red-400 bg-red-500/10 border-red-500/20',
  ARCHIVED: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

function MetaAdsTab() {
  const [datePreset, setDatePreset] = useState('last_30d');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [previewAd, setPreviewAd] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [manualAccountId, setManualAccountId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('spend');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    (async () => {
      try {
        const res = await mgmtApi.metaAdsAccounts();
        setAccounts(res.accounts || []);
        if (res.accounts?.length === 1) setSelectedAccount(res.accounts[0].id);
      } catch (_) {}
    })();
  }, []);

  const activeAccountId = selectedAccount || manualAccountId;

  const load = async (preset = datePreset, account = activeAccountId) => {
    setLoading(true); setError(null);
    try { setData(await mgmtApi.metaAds(preset, account)); }
    catch (e) { setError(e?.data?.error || 'Failed to fetch Meta Ads data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handlePresetChange = (val) => { setDatePreset(val); load(val, activeAccountId); };
  const handleAccountChange = (val) => { setSelectedAccount(val); load(datePreset, val); };
  const handleManualLoad = () => { if (manualAccountId.trim()) load(datePreset, manualAccountId.trim()); };

  const ads = data?.ads || [];

  const handleSort = (key) => {
    if (sortKey === key) { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); }
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedAds = [...ads].sort((a, b) => {
    const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0;
    const dir = sortDir === 'desc' ? -1 : 1;
    if (typeof va === 'string') return dir * va.localeCompare(vb);
    return dir * ((va < vb) ? -1 : (va > vb) ? 1 : 0);
  });

  const totals = ads.reduce((acc, ad) => ({
    spend: acc.spend + ad.spend, impressions: acc.impressions + ad.impressions,
    reach: acc.reach + ad.reach, regs: acc.regs + ad.regs,
    checkouts: acc.checkouts + ad.checkouts, purchases: acc.purchases + ad.purchases,
  }), { spend: 0, impressions: 0, reach: 0, regs: 0, checkouts: 0, purchases: 0 });

  const cols = [
    { key: 'name', label: 'Ad Name', width: 'min-w-[180px]' },
    { key: 'status', label: 'Status', width: 'min-w-[80px]' },
    { key: 'spend', label: 'Spend ($)', width: 'min-w-[90px]', align: 'right' },
    { key: 'regs', label: 'Regs', width: 'min-w-[70px]', align: 'right' },
    { key: 'purchases', label: 'Purchases', width: 'min-w-[90px]', align: 'right' },
    { key: 'cost_per_reg', label: 'Cost / Reg ($)', width: 'min-w-[110px]', align: 'right' },
    { key: 'cost_per_checkout', label: 'Cost / FTP ($)', width: 'min-w-[110px]', align: 'right' },
    { key: 'cost_per_purchase', label: 'Cost / Purchase ($)', width: 'min-w-[140px]', align: 'right' },
    { key: 'roas', label: 'ROAS', width: 'min-w-[70px]', align: 'right' },
    { key: 'ctr', label: 'CTR (%)', width: 'min-w-[80px]', align: 'right' },
    { key: 'reg_to_ftp_pct', label: 'Reg → FTP %', width: 'min-w-[100px]', align: 'right' },
    { key: 'reg_to_purchase_pct', label: 'Reg → Purchase %', width: 'min-w-[130px]', align: 'right' },
    { key: 'impressions', label: 'Impressions', width: 'min-w-[100px]', align: 'right' },
    { key: 'reach', label: 'Reach', width: 'min-w-[80px]', align: 'right' },
  ];

  return (
    <>
      {previewAd && (
        <div className="fixed inset-0 z-9999 flex items-start justify-center bg-black/80 backdrop-blur-sm overflow-y-auto py-8 px-4" onClick={() => setPreviewAd(null)}>
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewAd(null)} className="absolute -top-3 -right-3 z-10 w-7 h-7 bg-[#0c0f1a] border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="bg-[#0c0f1a] border border-white/8 rounded-2xl overflow-hidden">
              {previewLoading ? (
                <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 text-blue-400 animate-spin" /></div>
              ) : previewAd.embedHtml ? (() => {
                const srcMatch = previewAd.embedHtml.match(/src="([^"]+)"/);
                if (!srcMatch) return null;
                const w = 480, h = Math.round(w * 1350 / 1080);
                const src = srcMatch[1].replace(/width=\d+/, `width=${w}`);
                return <iframe src={src} width={w} height={h} style={{ border: 'none', display: 'block', width: '100%' }} allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen />;
              })() : previewAd.isVideo ? (
                <video src={previewAd.video_url || previewAd.thumbnail_url} poster={previewAd.video_url && previewAd.thumbnail_url ? previewAd.thumbnail_url : undefined} controls autoPlay muted loop playsInline className="w-full object-contain max-h-[70vh]" />
              ) : previewAd.thumbnail_url ? (
                <img src={previewAd.thumbnail_url} alt={previewAd.name} className="w-full object-contain max-h-[70vh]" />
              ) : (
                <div className="flex items-center justify-center h-48"><p className="text-xs text-slate-600">No creative available</p></div>
              )}
              <div className="px-4 py-3 border-t border-white/6">
                <p className="text-sm font-bold text-white truncate">{previewAd.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">${previewAd.spend.toFixed(2)} spend · {previewAd.regs} regs · ROAS {previewAd.roas || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <Section title="Meta Ads Performance" icon={BarChart2}>
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          {accounts.length > 1 && (
            <select value={selectedAccount} onChange={e => handleAccountChange(e.target.value)} className="bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none cursor-pointer">
              <option value="">Auto detect</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
            </select>
          )}
          {accounts.length === 0 && (
            <div className="flex items-center gap-2">
              <input value={manualAccountId} onChange={e => setManualAccountId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleManualLoad()} placeholder="Ad Account ID (e.g. 123456789)" className="bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none w-52 placeholder:text-slate-700" />
              <button onClick={handleManualLoad} disabled={!manualAccountId.trim() || loading} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all">Load</button>
            </div>
          )}
          <select value={datePreset} onChange={e => handlePresetChange(e.target.value)} className="bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none cursor-pointer">
            {DATE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button onClick={() => load()} disabled={loading} className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/8 hover:border-blue-500/30 text-slate-400 hover:text-white text-xs font-black rounded-xl transition-all disabled:opacity-50">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </button>
          {data && <span className="text-xs text-slate-600">{data.count} ads</span>}
        </div>
        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-500/8 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
        {ads.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
            {[
              { label: 'Total Spend', value: `$${totals.spend.toFixed(2)}` },
              { label: 'Impressions', value: totals.impressions.toLocaleString() },
              { label: 'Reach', value: totals.reach.toLocaleString() },
              { label: 'Registrations', value: totals.regs },
              { label: 'FTP (Checkout)', value: totals.checkouts },
              { label: 'Purchases', value: totals.purchases },
            ].map(s => (
              <div key={s.label} className="bg-black/30 border border-white/5 rounded-xl px-3 py-2.5">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">{s.label}</p>
                <p className="text-sm font-black text-white">{s.value}</p>
              </div>
            ))}
          </div>
        )}
        {loading && !data ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-slate-500 animate-spin" /></div>
        ) : ads.length === 0 && !error ? (
          <div className="text-center py-10 text-slate-600 text-sm">No ad data found for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  {cols.map(c => (
                    <th key={c.key} onClick={() => handleSort(c.key)} className={`cursor-pointer select-none text-[9px] font-black uppercase tracking-widest pb-3 pr-4 ${c.width} ${c.align === 'right' ? 'text-right' : 'text-left'} hover:text-slate-300 transition-colors ${sortKey === c.key ? 'text-blue-400' : 'text-slate-600'}`}>
                      <span className={`inline-flex items-center gap-1 ${c.align === 'right' ? 'justify-end' : ''}`}>
                        {c.label}
                        <span className="text-[8px] opacity-70">{sortKey === c.key ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}</span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedAds.map(ad => (
                  <tr key={ad.id} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                    <td className="py-2.5 pr-4 text-white font-medium max-w-50">
                      <button onClick={async () => {
                        setPreviewAd({ ...ad, thumbnail_url: null, video_url: null, isVideo: false });
                        setPreviewLoading(true);
                        try {
                          const token = localStorage.getItem('access_token');
                          const r = await fetch(`/api/mgmt/meta-ads/creative/${ad.id}/`, { headers: { Authorization: `Bearer ${token}` } });
                          if (r.ok) {
                            const ct = r.headers.get('content-type') || '';
                            if (ct.includes('application/json')) {
                              const json = await r.json();
                              if (json.media_type === 'video' && json.video_url) setPreviewAd({ ...ad, thumbnail_url: json.poster_url || null, video_url: json.video_url, isVideo: true, embedHtml: null });
                              else if (json.media_type === 'embed' && json.embed_html) setPreviewAd({ ...ad, thumbnail_url: json.poster_url || null, video_url: null, isVideo: false, embedHtml: json.embed_html });
                            } else {
                              const isVideo = ct.startsWith('video/') || ct.includes('mp4');
                              const blob = await r.blob();
                              setPreviewAd({ ...ad, thumbnail_url: URL.createObjectURL(blob), video_url: null, isVideo });
                            }
                          }
                        } catch (_) {}
                        setPreviewLoading(false);
                      }} className="truncate text-left w-full hover:text-blue-400 cursor-pointer transition-colors" title={ad.name}>{ad.name}</button>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[ad.status] || STATUS_COLORS.ARCHIVED}`}>{ad.status}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-slate-300 font-mono">${ad.spend.toFixed(2)}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-300 font-mono">{ad.regs}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-300 font-mono">{ad.purchases}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-400 font-mono">{ad.cost_per_reg > 0 ? `$${ad.cost_per_reg}` : '—'}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-400 font-mono">{ad.cost_per_checkout > 0 ? `$${ad.cost_per_checkout}` : '—'}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-400 font-mono">{ad.cost_per_purchase > 0 ? `$${ad.cost_per_purchase}` : '—'}</td>
                    <td className="py-2.5 pr-4 text-right font-mono font-bold" style={{ color: ad.roas >= 2 ? '#34d399' : ad.roas >= 1 ? '#fbbf24' : 'var(--text-muted)' }}>{ad.roas > 0 ? ad.roas : '—'}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-400 font-mono">{ad.ctr > 0 ? `${ad.ctr}%` : '—'}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-400 font-mono">{ad.reg_to_ftp_pct > 0 ? `${ad.reg_to_ftp_pct}%` : '—'}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-400 font-mono">{ad.reg_to_purchase_pct > 0 ? `${ad.reg_to_purchase_pct}%` : '—'}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-500 font-mono">{ad.impressions.toLocaleString()}</td>
                    <td className="py-2.5 text-right text-slate-500 font-mono">{ad.reach.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

// ──────────────────────────────────────────────
// Data Users Tab
// ──────────────────────────────────────────────

function DataUsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    mgmtApi.dataUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = async (user) => {
    setToggling(user.id);
    try {
      const updated = await mgmtApi.updateDataUser(user.id, !user.is_data_user);
      setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, is_data_user: updated.is_data_user } : u));
    } catch (_) {}
    setToggling(null);
  };

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Section title={`Data Users (${users.filter(u => u.is_data_user).length})`} icon={Database}>
      <div className="space-y-4">
        <p className="text-xs text-slate-500">Users with access to the Manage Data page.</p>
        <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-black/30 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20 transition-colors" />
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-slate-500 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['User', 'Name', 'Manage Data Access'].map(h => (
                    <th key={h} className="text-left text-[10px] font-black text-slate-600 uppercase tracking-widest px-3 py-2 border-b border-white/5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                    <td className="px-3 py-3 text-sm text-white font-medium">{u.email}</td>
                    <td className="px-3 py-3 text-sm text-slate-400">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-3 py-3">
                      <button onClick={() => toggle(u)} disabled={toggling === u.id} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${u.is_data_user ? 'bg-red-500' : 'bg-white/10'}`}>
                        {toggling === u.id ? <Loader2 className="w-3 h-3 text-white animate-spin mx-auto" /> : <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${u.is_data_user ? 'translate-x-4.5' : 'translate-x-0.5'}`} />}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={3} className="text-center py-6 text-slate-600 text-sm">No users found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────
// Upper Management Tab
// ──────────────────────────────────────────────

const ALL_TABS_LIST = [
  { key: 'meta', label: 'Meta Ads', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  { key: 'workspaces', label: 'Workspaces', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { key: 'users', label: 'Users', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { key: 'plans', label: 'Plans', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  { key: 'data-users', label: 'Data Users', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
];

function UpperManagementTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    mgmtApi.permissions().then(setUsers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleTab = async (user, tab) => {
    const current = user.tabs || [];
    const next = current.includes(tab) ? current.filter(t => t !== tab) : [...current, tab];
    setSaving(`${user.id}-${tab}`);
    try {
      const updated = await mgmtApi.updatePermission(user.id, next);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, tabs: updated.tabs } : u));
    } catch (_) {}
    setSaving(null);
  };

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Section title="Upper Management" icon={Crown}>
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Configure which RMGS Management tabs each user can access. Users with no tabs granted cannot see the management panel at all.
        </p>
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-black/30 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20 transition-colors"
        />
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-slate-500 animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {filtered.map(u => (
              <div key={u.id} className="p-4 bg-black/20 border border-white/5 rounded-xl hover:border-white/10 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white truncate">{u.email}</p>
                      {u.is_upper_management && (
                        <span className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border text-amber-400 bg-amber-500/10 border-amber-500/20 uppercase tracking-wider">
                          <Crown className="w-2.5 h-2.5" /> Upper Mgmt
                        </span>
                      )}
                      {u.is_rmgs_admin && !u.is_upper_management && (
                        <span className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border text-red-400 bg-red-500/10 border-red-500/20 uppercase tracking-wider">
                          <Shield className="w-2.5 h-2.5" /> Full Admin
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{u.full_name}</p>
                  </div>

                  {u.is_rmgs_admin ? (
                    <p className="text-[10px] text-slate-600 shrink-0 mt-1">All tabs (hardcoded)</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {ALL_TABS_LIST.map(t => {
                        const active = (u.tabs || []).includes(t.key);
                        const isLoading = saving === `${u.id}-${t.key}`;
                        return (
                          <button
                            key={t.key}
                            onClick={() => toggleTab(u, t.key)}
                            disabled={!!saving}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${active ? t.color : 'text-slate-700 bg-white/3 border-white/6 hover:border-white/12'}`}
                          >
                            {isLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : active ? <Check className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center py-6 text-slate-600 text-sm">No users found</p>}
          </div>
        )}
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────

const ALL_TAB_DEFS = [
  { key: 'meta',              label: 'Meta Ads',          Icon: BarChart2  },
  { key: 'workspaces',        label: 'Workspaces',        Icon: Building2  },
  { key: 'users',             label: 'Users',             Icon: Users      },
  { key: 'plans',             label: 'Plans',             Icon: CreditCard },
  { key: 'data-users',        label: 'Data Users',        Icon: Database   },
  { key: 'upper-management',  label: 'Upper Management',  Icon: Crown      },
];

export default function RMGSManagement() {
  const { user } = useAuth();
  const [permInfo, setPermInfo] = useState(null);
  const [tab, setTab] = useState(null);

  useEffect(() => {
    mgmtApi.myPermissions()
      .then(p => {
        setPermInfo(p);
        const firstTab = p.tabs[0] || (p.is_upper_management ? 'upper-management' : null);
        setTab(prev => prev || firstTab);
      })
      .catch(() => setPermInfo({ tabs: [], is_upper_management: false }));
  }, []);

  if (!permInfo) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  if (permInfo.tabs.length === 0 && !permInfo.is_upper_management) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="w-10 h-10 text-slate-700" />
        <p className="text-slate-500 text-sm">No access</p>
      </div>
    );
  }

  const visibleTabs = ALL_TAB_DEFS.filter(t => {
    if (t.key === 'upper-management') return permInfo.is_upper_management;
    return permInfo.tabs.includes(t.key);
  });

  const activeTab = tab || visibleTabs[0]?.key;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">RMGS Management</h1>
          <p className="text-xs text-slate-500">Admin panel — restricted access</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 p-1 bg-white/3 border border-white/6 rounded-xl w-fit">
        {visibleTabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeTab === key ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}
          >
            {activeTab === key && (
              <motion.div
                layoutId="mgmt-tab-pill"
                className="absolute inset-0 bg-white/8 border border-white/10 rounded-lg"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <Icon className="relative w-3.5 h-3.5" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
          {activeTab === 'meta'             && <MetaAdsTab />}
          {activeTab === 'workspaces'       && <WorkspacesTab />}
          {activeTab === 'users'            && <UsersTab />}
          {activeTab === 'plans'            && <PlansTab />}
          {activeTab === 'data-users'       && <DataUsersTab />}
          {activeTab === 'upper-management' && <UpperManagementTab />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
