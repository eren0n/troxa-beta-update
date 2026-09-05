import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Users, Building2, CreditCard, ChevronDown, ChevronRight,
  Plus, X, Check, Loader2, Edit2, RefreshCw, AlertTriangle, BarChart2, Database,
} from 'lucide-react';
import { mgmtApi } from '../../lib/api';

const PLAN_TIERS = ['free', 'individual', 'team', 'enterprise'];

const PLAN_COLORS = {
  free: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  individual: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  team: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  enterprise: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
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
    <div className="bg-[#0d1017] border border-white/6 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
        <Icon className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-black text-white">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

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

  const load = async () => {
    setLoading(true);
    try { setUsers(await mgmtApi.users()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    setSaving(true);
    setError(null);
    try {
      const u = await mgmtApi.createUser(form);
      setUsers(prev => [u, ...prev]);
      setShowAdd(false);
      setForm({ email: '', password: '', first_name: '', last_name: '' });
    } catch (e) {
      setError(e?.data?.error || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title={`Users (${users.length})`} icon={Users}>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Add User
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="p-4 bg-blue-500/5 border border-blue-500/15 rounded-xl space-y-3">
              <p className="text-xs font-black text-blue-400 uppercase tracking-widest">New User</p>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} placeholder="First Name" className="bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-slate-700" />
                <input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} placeholder="Last Name" className="bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-slate-700" />
                <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="Email" type="email" className="bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-slate-700" />
                <input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Password" type="password" className="bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-slate-700" />
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
                {['Email', 'Name', 'Workspaces', 'Joined', 'Status'].map(h => (
                  <th key={h} className="text-left text-[10px] font-black text-slate-600 uppercase tracking-widest pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                  <td className="py-3 pr-4 text-sm text-white font-mono">{u.email}</td>
                  <td className="py-3 pr-4 text-sm text-slate-400">{u.full_name}</td>
                  <td className="py-3 pr-4 text-sm text-slate-400">{u.ws_count}</td>
                  <td className="py-3 pr-4 text-xs text-slate-600">{new Date(u.date_joined).toLocaleDateString()}</td>
                  <td className="py-3">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${u.is_active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
                      {u.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                </tr>
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
  const [creditInput, setCreditInput] = useState(String(ws.credit_balance));
  const [savingCredits, setSavingCredits] = useState(false);
  const [editPlan, setEditPlan] = useState(false);
  const [planInput, setPlanInput] = useState(ws.plan_tier);
  const [savingPlan, setSavingPlan] = useState(false);

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
      await mgmtApi.updateCredits(ws.id, parseInt(creditInput));
      onUpdated(ws.id, { credit_balance: parseInt(creditInput) });
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

  return (
    <>
      <tr
        className="border-b border-white/4 hover:bg-white/2 transition-colors cursor-pointer"
        onClick={toggle}
      >
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
            <span className="text-sm text-white font-medium">{ws.name}</span>
          </div>
        </td>
        <td className="py-3 pr-4 text-xs text-slate-500 font-mono">{ws.owner_email}</td>
        <td className="py-3 pr-4"><Badge tier={ws.plan_tier} /></td>
        <td className="py-3 pr-4 text-sm text-white font-bold">{ws.credit_balance}</td>
        <td className="py-3 pr-4 text-sm text-slate-400">{ws.member_count}</td>
        <td className="py-3 text-xs text-slate-600">{new Date(ws.created_at).toLocaleDateString()}</td>
      </tr>

      <AnimatePresence>
        {expanded && (
          <tr>
            <td colSpan={6} className="p-0">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white/2 border-b border-white/5 px-8 py-5 space-y-5">
                  {/* Actions row */}
                  <div className="flex flex-wrap gap-3">
                    {/* Credits editor */}
                    {editCredits ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={creditInput}
                          onChange={e => setCreditInput(e.target.value)}
                          className="w-28 bg-black/40 border border-blue-500/40 rounded-xl px-3 py-1.5 text-sm text-white outline-none"
                          onClick={e => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); saveCredits(); }}
                          disabled={savingCredits}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all"
                        >
                          {savingCredits ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setEditCredits(false); }} className="px-3 py-1.5 bg-white/5 border border-white/8 text-slate-400 text-xs font-black rounded-xl">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setCreditInput(String(ws.credit_balance)); setEditCredits(true); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black rounded-xl hover:bg-blue-500/20 transition-all"
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Edit Credits ({ws.credit_balance})
                      </button>
                    )}

                    {/* Plan editor */}
                    {editPlan ? (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <select
                          value={planInput}
                          onChange={e => setPlanInput(e.target.value)}
                          className="bg-black/40 border border-purple-500/40 rounded-xl px-3 py-1.5 text-sm text-white outline-none cursor-pointer"
                        >
                          {PLAN_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button
                          onClick={savePlan}
                          disabled={savingPlan}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all"
                        >
                          {savingPlan ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                        </button>
                        <button onClick={() => setEditPlan(false)} className="px-3 py-1.5 bg-white/5 border border-white/8 text-slate-400 text-xs font-black rounded-xl">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPlanInput(ws.plan_tier); setEditPlan(true); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-black rounded-xl hover:bg-purple-500/20 transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Change Plan ({ws.plan_name})
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
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Members</p>
                        <div className="space-y-1.5">
                          {detail.members.map(m => (
                            <div key={m.id} className="flex items-center justify-between px-3 py-2 bg-black/20 border border-white/4 rounded-xl">
                              <div>
                                <p className="text-xs text-white">{m.email}</p>
                                <p className="text-[10px] text-slate-600">{m.full_name}</p>
                              </div>
                              <span className="text-[10px] font-black text-slate-500 uppercase">{m.role}</span>
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
                                <p className="text-xs text-white truncate max-w-[140px]">{j.model_name}</p>
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
    setSaving(true);
    setError(null);
    try {
      const ws = await mgmtApi.createWorkspace(form);
      setWorkspaces(prev => [ws, ...prev]);
      setShowAdd(false);
      setForm({ name: '', owner_email: '', plan_tier: 'free' });
    } catch (e) {
      setError(e?.data?.error || 'Failed to create workspace');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdated = (id, patch) => {
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));
  };

  return (
    <Section title={`Workspaces (${workspaces.length})`} icon={Building2}>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Create Workspace
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="p-4 bg-blue-500/5 border border-blue-500/15 rounded-xl space-y-3">
              <p className="text-xs font-black text-blue-400 uppercase tracking-widest">New Workspace</p>
              <div className="grid grid-cols-3 gap-3">
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Workspace Name" className="bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-slate-700" />
                <input value={form.owner_email} onChange={e => setForm(p => ({ ...p, owner_email: e.target.value }))} placeholder="Owner Email" className="bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-slate-700" />
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
// Plans Tab
// ──────────────────────────────────────────────

const EMPTY_PLAN = { name: '', tier: '', credit_limit: 0, member_limit: 1, price_monthly: '0.00', features: '', is_active: true };

function PlansTab() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
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
    setForm({ ...plan, features: (plan.features || []).join(', ') });
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await mgmtApi.updatePlan(editing, {
        name: form.name,
        credit_limit: parseInt(form.credit_limit),
        member_limit: parseInt(form.member_limit),
        price_monthly: form.price_monthly,
        is_active: form.is_active,
        features: form.features ? form.features.split(',').map(f => f.trim()).filter(Boolean) : [],
      });
      setPlans(prev => prev.map(p => p.id === editing ? updated : p));
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const created = await mgmtApi.createPlan({
        ...newForm,
        credit_limit: parseInt(newForm.credit_limit),
        member_limit: parseInt(newForm.member_limit),
        features: newForm.features ? newForm.features.split(',').map(f => f.trim()).filter(Boolean) : [],
      });
      setPlans(prev => [...prev, created]);
      setShowAdd(false);
      setNewForm(EMPTY_PLAN);
    } catch (e) {
      setCreateError(e?.data?.error || 'Failed to create plan');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Section title={`Plans (${plans.length})`} icon={CreditCard}>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> New Plan
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 overflow-hidden"
          >
            <div className="p-5 bg-blue-500/5 border border-blue-500/15 rounded-2xl space-y-4">
              <p className="text-xs font-black text-blue-400 uppercase tracking-widest">New Plan</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Plan Name</p>
                  <input value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Pro" className="w-full bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-slate-700" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Tier Key</p>
                  <input value={newForm.tier} onChange={e => setNewForm(p => ({ ...p, tier: e.target.value }))} placeholder="e.g. pro" className="w-full bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-slate-700" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Credit Limit</p>
                  <input type="number" value={newForm.credit_limit} onChange={e => setNewForm(p => ({ ...p, credit_limit: e.target.value }))} className="w-full bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Member Limit</p>
                  <input type="number" value={newForm.member_limit} onChange={e => setNewForm(p => ({ ...p, member_limit: e.target.value }))} className="w-full bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Price / Month ($)</p>
                  <input type="number" step="0.01" value={newForm.price_monthly} onChange={e => setNewForm(p => ({ ...p, price_monthly: e.target.value }))} className="w-full bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Status</p>
                  <select value={newForm.is_active} onChange={e => setNewForm(p => ({ ...p, is_active: e.target.value === 'true' }))} className="w-full bg-black/40 border border-white/8 rounded-xl px-3 py-2 text-sm text-white outline-none cursor-pointer">
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Features <span className="normal-case font-normal text-slate-700">(comma separated)</span></p>
                  <input value={newForm.features} onChange={e => setNewForm(p => ({ ...p, features: e.target.value }))} placeholder="API Access, Priority Support, ..." className="w-full bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-slate-700" />
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
                  <button onClick={() => startEdit(plan)} className="p-1.5 text-slate-500 hover:text-white transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Credit Limit', field: 'credit_limit', suffix: 'cr' },
                  { label: 'Member Limit', field: 'member_limit', suffix: 'users' },
                  { label: 'Price / Month', field: 'price_monthly', prefix: '$' },
                ].map(({ label, field, suffix, prefix }) => (
                  <div key={field}>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">{label}</p>
                    {editing === plan.id ? (
                      <input
                        type="number"
                        value={form[field]}
                        onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                        className="w-full bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-1.5 text-sm text-white outline-none"
                      />
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
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Features <span className="normal-case font-normal text-slate-700">(comma separated)</span></p>
                  <input value={form.features} onChange={e => setForm(p => ({ ...p, features: e.target.value }))} className="w-full bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-1.5 text-sm text-white outline-none" />
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

  // Fetch available accounts on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await mgmtApi.metaAdsAccounts();
        setAccounts(res.accounts || []);
        if (res.accounts?.length === 1) {
          setSelectedAccount(res.accounts[0].id);
        }
      } catch (_) {}
    })();
  }, []);

  const activeAccountId = selectedAccount || manualAccountId;

  const load = async (preset = datePreset, account = activeAccountId) => {
    setLoading(true);
    setError(null);
    try {
      setData(await mgmtApi.metaAds(preset, account));
    } catch (e) {
      setError(e?.data?.error || 'Failed to fetch Meta Ads data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handlePresetChange = (val) => {
    setDatePreset(val);
    load(val, activeAccountId);
  };

  const handleAccountChange = (val) => {
    setSelectedAccount(val);
    load(datePreset, val);
  };

  const handleManualLoad = () => {
    if (manualAccountId.trim()) load(datePreset, manualAccountId.trim());
  };

  const ads = data?.ads || [];

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedAds = [...ads].sort((a, b) => {
    const va = a[sortKey] ?? 0;
    const vb = b[sortKey] ?? 0;
    const dir = sortDir === 'desc' ? -1 : 1;
    if (typeof va === 'string') return dir * va.localeCompare(vb);
    return dir * ((va < vb) ? -1 : (va > vb) ? 1 : 0);
  });

  // Summary totals
  const totals = ads.reduce((acc, ad) => ({
    spend: acc.spend + ad.spend,
    impressions: acc.impressions + ad.impressions,
    reach: acc.reach + ad.reach,
    regs: acc.regs + ad.regs,
    checkouts: acc.checkouts + ad.checkouts,
    purchases: acc.purchases + ad.purchases,
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
      <div
        className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/80 backdrop-blur-sm overflow-y-auto py-8 px-4"
        onClick={() => setPreviewAd(null)}
      >
        <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setPreviewAd(null)}
            className="absolute -top-3 -right-3 z-10 w-7 h-7 bg-[#0c0f1a] border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="bg-[#0c0f1a] border border-white/8 rounded-2xl overflow-hidden">
            {previewLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            ) : previewAd.embedHtml ? (() => {
              const srcMatch = previewAd.embedHtml.match(/src="([^"]+)"/);
              if (!srcMatch) return null;
              const w = 480;
              const h = Math.round(w * 1350 / 1080);
              const src = srcMatch[1].replace(/width=\d+/, `width=${w}`);
              return (
                <iframe
                  src={src}
                  width={w}
                  height={h}
                  style={{ border: 'none', display: 'block', width: '100%' }}
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  allowFullScreen
                />
              );
            })() : previewAd.isVideo ? (
              <video
                src={previewAd.video_url || previewAd.thumbnail_url}
                poster={previewAd.video_url && previewAd.thumbnail_url ? previewAd.thumbnail_url : undefined}
                controls
                autoPlay
                muted
                loop
                playsInline
                className="w-full object-contain max-h-[70vh]"
              />
            ) : previewAd.thumbnail_url ? (
              <img
                src={previewAd.thumbnail_url}
                alt={previewAd.name}
                className="w-full object-contain max-h-[70vh]"
              />
            ) : (
              <div className="flex items-center justify-center h-48">
                <p className="text-xs text-slate-600">No creative available</p>
              </div>
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
      {/* Controls */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {accounts.length > 1 && (
          <select
            value={selectedAccount}
            onChange={e => handleAccountChange(e.target.value)}
            className="bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none cursor-pointer"
          >
            <option value="">Auto detect</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
          </select>
        )}
        {accounts.length === 0 && (
          <div className="flex items-center gap-2">
            <input
              value={manualAccountId}
              onChange={e => setManualAccountId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualLoad()}
              placeholder="Ad Account ID (e.g. 123456789)"
              className="bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none w-52 placeholder:text-slate-700"
            />
            <button
              onClick={handleManualLoad}
              disabled={!manualAccountId.trim() || loading}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all"
            >
              Load
            </button>
          </div>
        )}
        <select
          value={datePreset}
          onChange={e => handlePresetChange(e.target.value)}
          className="bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-white outline-none cursor-pointer"
        >
          {DATE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <button
          onClick={() => load()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/8 hover:border-blue-500/30 text-slate-400 hover:text-white text-xs font-black rounded-xl transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
        {data && <span className="text-xs text-slate-600">{data.count} ads</span>}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-500/8 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Summary cards */}
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
                  <th
                    key={c.key}
                    onClick={() => handleSort(c.key)}
                    className={`cursor-pointer select-none text-[9px] font-black uppercase tracking-widest pb-3 pr-4 ${c.width} ${c.align === 'right' ? 'text-right' : 'text-left'} hover:text-slate-300 transition-colors ${sortKey === c.key ? 'text-blue-400' : 'text-slate-600'}`}
                  >
                    <span className={`inline-flex items-center gap-1 ${c.align === 'right' ? 'justify-end' : ''}`}>
                      {c.label}
                      <span className="text-[8px] opacity-70">
                        {sortKey === c.key ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedAds.map(ad => (
                <tr key={ad.id} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                  <td className="py-2.5 pr-4 text-white font-medium max-w-[200px]">
                    <button
                      onClick={async () => {
                        setPreviewAd({ ...ad, thumbnail_url: null, video_url: null, isVideo: false });
                        setPreviewLoading(true);
                        try {
                          const token = localStorage.getItem('access_token');
                          const r = await fetch(`/api/mgmt/meta-ads/creative/${ad.id}/`, {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          if (r.ok) {
                            const ct = r.headers.get('content-type') || '';
                            if (ct.includes('application/json')) {
                              const json = await r.json();
                              if (json.media_type === 'video' && json.video_url) {
                                setPreviewAd({ ...ad, thumbnail_url: json.poster_url || null, video_url: json.video_url, isVideo: true, embedHtml: null });
                              } else if (json.media_type === 'embed' && json.embed_html) {
                                setPreviewAd({ ...ad, thumbnail_url: json.poster_url || null, video_url: null, isVideo: false, embedHtml: json.embed_html });
                              }
                            } else {
                              const isVideo = ct.startsWith('video/') || ct.includes('mp4');
                              const blob = await r.blob();
                              setPreviewAd({ ...ad, thumbnail_url: URL.createObjectURL(blob), video_url: null, isVideo });
                            }
                          }
                        } catch (_) {}
                        setPreviewLoading(false);
                      }}
                      className="truncate text-left w-full hover:text-blue-400 cursor-pointer transition-colors"
                      title={ad.name}
                    >
                      {ad.name}
                    </button>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[ad.status] || STATUS_COLORS.ARCHIVED}`}>
                      {ad.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-slate-300 font-mono">${ad.spend.toFixed(2)}</td>
                  <td className="py-2.5 pr-4 text-right text-slate-300 font-mono">{ad.regs}</td>
                  <td className="py-2.5 pr-4 text-right text-slate-300 font-mono">{ad.purchases}</td>
                  <td className="py-2.5 pr-4 text-right text-slate-400 font-mono">{ad.cost_per_reg > 0 ? `$${ad.cost_per_reg}` : '—'}</td>
                  <td className="py-2.5 pr-4 text-right text-slate-400 font-mono">{ad.cost_per_checkout > 0 ? `$${ad.cost_per_checkout}` : '—'}</td>
                  <td className="py-2.5 pr-4 text-right text-slate-400 font-mono">{ad.cost_per_purchase > 0 ? `$${ad.cost_per_purchase}` : '—'}</td>
                  <td className="py-2.5 pr-4 text-right font-mono font-bold" style={{ color: ad.roas >= 2 ? '#34d399' : ad.roas >= 1 ? '#fbbf24' : '#94a3b8' }}>
                    {ad.roas > 0 ? ad.roas : '—'}
                  </td>
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

  const dataUsers = users.filter(u => u.is_data_user);

  return (
    <Section title={`Data Users (${dataUsers.length})`} icon={Database}>
      <div className="space-y-4">
        <p className="text-xs text-slate-500">Users with access to the Manage Data page. Toggle access on or off per user.</p>

        <div className="relative">
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/30 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20 transition-colors"
          />
        </div>

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
                      <button
                        onClick={() => toggle(u)}
                        disabled={toggling === u.id}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${u.is_data_user ? 'bg-red-500' : 'bg-white/10'}`}
                      >
                        {toggling === u.id ? (
                          <Loader2 className="w-3 h-3 text-white animate-spin mx-auto" />
                        ) : (
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${u.is_data_user ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-6 text-slate-600 text-sm">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────

const TABS = [
  { key: 'meta', label: 'Meta Ads', Icon: BarChart2 },
  { key: 'workspaces', label: 'Workspaces', Icon: Building2 },
  { key: 'users', label: 'Users', Icon: Users },
  { key: 'plans', label: 'Plans', Icon: CreditCard },
  { key: 'data-users', label: 'Data Users', Icon: Database },
];

export default function RMGSManagement() {
  const [tab, setTab] = useState('meta');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">RMGS Management</h1>
          <p className="text-xs text-slate-500">Admin panel — restricted access</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-white/3 border border-white/6 rounded-xl w-fit">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${tab === key ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}
          >
            {tab === key && (
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

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {tab === 'meta' && <MetaAdsTab />}
          {tab === 'workspaces' && <WorkspacesTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'plans' && <PlansTab />}
          {tab === 'data-users' && <DataUsersTab />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
