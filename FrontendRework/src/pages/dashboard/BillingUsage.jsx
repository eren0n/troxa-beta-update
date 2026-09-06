import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard, Download, ArrowUpRight, FileText, TrendingUp, Users,
  Zap, Shield, ChevronRight, Sparkles, Building2,
  BarChart3, Clock, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { billingApi } from '../../lib/api';
import { GLASS_STYLE } from '../../components/ui/GlassCard';


const colorMap = {
  blue:   { bar: 'bg-blue-500',   text: 'text-blue-400',   bg: 'bg-blue-500/8',   border: 'border-blue-500/15',   icon: 'text-blue-400'   },
  purple: { bar: 'bg-purple-500', text: 'text-purple-400', bg: 'bg-purple-500/8', border: 'border-purple-500/15', icon: 'text-purple-400' },
  emerald:{ bar: 'bg-emerald-500',text: 'text-emerald-400',bg: 'bg-emerald-500/8',border: 'border-emerald-500/15',icon: 'text-emerald-400'},
};

const barData = [40, 65, 45, 90, 70, 85, 100, 80, 60, 75, 55, 95];

export default function BillingUsage() {
  const { credits: ctxCredits, activeWorkspace } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [credits, setCredits] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [creditsRes, planRes, txRes] = await Promise.allSettled([
        billingApi.credits(),
        billingApi.currentPlan(),
        billingApi.transactions(),
      ]);
      if (creditsRes.status === 'fulfilled') setCredits(creditsRes.value);
      if (planRes.status === 'fulfilled') setCurrentPlan(planRes.value);
      if (txRes.status === 'fulfilled') setTransactions(txRes.value?.results || txRes.value || []);
      setLoading(false);
    })();
  }, []);

  const effectiveCredits = credits || ctxCredits;
  const balance = effectiveCredits?.balance ?? 0;
  const used = effectiveCredits?.used ?? 0;
  const total = balance + used;

  // plan field can be a string (CreditsSerializer) or nested object (WorkspaceCreditSerializer)
  const _planObj = typeof effectiveCredits?.plan === 'object' && effectiveCredits?.plan !== null
    ? effectiveCredits.plan
    : (currentPlan?.plan && typeof currentPlan.plan === 'object' ? currentPlan.plan : null);
  const _planStr = typeof effectiveCredits?.plan === 'string' ? effectiveCredits.plan
    : typeof currentPlan?.plan === 'string' ? currentPlan.plan : null;

  const tierFromWs = activeWorkspace?.tier;
  const TIER_NAMES = { individual: 'Individual', team: 'Pro Team', enterprise: 'Enterprise', free: 'Free Trial' };

  const planName = _planObj?.name || _planStr || TIER_NAMES[tierFromWs] || 'Free Trial';
  const planTier = (_planObj?.tier || effectiveCredits?.plan_tier || tierFromWs || 'free').toLowerCase();

  const usageMetrics = [
    { label: 'Credits Used', val: used, total: total || 10, icon: Zap, color: 'blue' },
    { label: 'Credits Remaining', val: balance, total: total || 10, icon: BarChart3, color: 'blue' },
  ];

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'invoices', label: 'Invoices' },
  ];

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Billing & Usage</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your iGaming platform subscription and credit consumption</p>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-blue-500/10 border border-white/6 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-5 py-2 rounded-lg text-sm font-black transition-all ${activeTab === tab.id ? 'text-white' : 'text-slate-400 hover:text-slate-400'}`}
          >
            {activeTab === tab.id && (
              <motion.div layoutId="billing-tab" className="absolute inset-0 bg-blue-500/10 border border-blue-500/20 rounded-lg" />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            {/* Plan banner */}
            {loading ? (
              <div className="h-28 bg-white/3 rounded-2xl animate-pulse" />
            ) : (
              <div
                className="p-6 border border-blue-500/15 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                style={{ background: 'linear-gradient(to right, var(--accent-muted), transparent)' }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/15 border border-blue-500/25 rounded-2xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-black text-white text-lg">{planName}</h3>
                      {planTier !== 'free' && <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-black uppercase">Active</span>}
                    </div>
                    <p className="text-slate-500 text-sm">{used} credits used · {balance} remaining</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-white">{balance}<span className="text-sm text-slate-600 font-normal"> left</span></p>
                  <p className="text-[10px] text-slate-700 mt-0.5">of {total} total credits</p>
                </div>
              </div>
            )}

            {/* Usage metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {usageMetrics.map((m, i) => {
                const c = colorMap[m.color];
                const pct = m.total > 0 ? Math.round((m.val / m.total) * 100) : 0;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    style={GLASS_STYLE} className="p-5 rounded-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center`}>
                          <m.icon className={`w-4 h-4 ${c.icon}`} />
                        </div>
                        <span className="text-sm font-black text-white">{m.label}</span>
                      </div>
                      <span className={`text-sm font-black ${c.text}`}>{pct}%</span>
                    </div>
                    <div>
                      <div className="flex items-end gap-1 mb-2">
                        <span className="text-xl font-black text-white">{m.val.toLocaleString()}</span>
                        <span className="text-slate-600 text-sm mb-0.5">/ {m.total.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-2 bg-white/4 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 + i * 0.07 }}
                          className={`h-full rounded-full ${c.bar}`}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Generation velocity chart (static placeholder — no analytics endpoint yet) */}
            <div style={GLASS_STYLE} className="rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-black text-white">Generation Velocity</h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">Daily usage over last 30 days</p>
                </div>
                <select className="text-[11px] bg-white/5 border border-white/8 text-slate-400 rounded-lg px-2.5 py-1.5 outline-none">
                  <option>Last 30 Days</option>
                  <option>Last Quarter</option>
                </select>
              </div>
              <div className="flex items-end gap-1.5 h-40">
                {barData.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.5, delay: i * 0.03, ease: 'easeOut' }}
                    className="flex-1 bg-blue-600/20 hover:bg-blue-600/40 transition-colors rounded-t-md relative group cursor-pointer"
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 border border-white/10 text-white text-[9px] font-black rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl" style={{ background: 'var(--dropdown-bg)' }}>
                      {h * 12} gen
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-700 mt-2 border-t border-white/5 pt-3">
                <span>May 01</span>
                <span>May 15</span>
                <span>Jun 01</span>
              </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div style={GLASS_STYLE} className="p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  <h4 className="font-black text-white text-sm">Payment Method</h4>
                </div>
                <div className="flex items-center gap-4 p-4 bg-blue-500/8 border border-blue-500/25 rounded-xl">
                  <div className="w-12 h-8 bg-[#0c0f1a] border border-white/8 rounded-lg flex items-center justify-center font-black text-xs text-blue-400">VISA</div>
                  <div>
                    <p className="text-sm font-bold text-white">•••• •••• •••• 4492</p>
                    <p className="text-[10px] text-slate-600">Expires 12/28</p>
                  </div>
                </div>
                <button className="w-full py-2.5 bg-blue-500/15 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl text-[11px] font-black text-white/90 hover:text-white transition-all uppercase tracking-wider">Replace Method</button>
              </div>
              <div style={GLASS_STYLE} className="p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <h4 className="font-black text-white text-sm">Credit Reset</h4>
                </div>
                <div className="p-4 bg-blue-500/8 border border-blue-500/25 rounded-xl">
                  <p className="text-xs text-slate-500">Credits refresh monthly</p>
                  <p className="text-2xl font-black text-white mt-1">{balance.toLocaleString()} <span className="text-sm text-slate-600 font-normal">left</span></p>
                </div>
                <button className="w-full py-2.5 bg-blue-500/15 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl text-[11px] font-black text-white/90 hover:text-white transition-all uppercase tracking-wider">Buy Extra Credits</button>
              </div>
            </div>
          </motion.div>
        )}


        {activeTab === 'invoices' && (
          <motion.div key="invoices" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={GLASS_STYLE} className="rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-black text-white">Invoice History</h3>
              <button className="flex items-center gap-2 text-[11px] font-black text-blue-400 hover:text-blue-300 transition-colors">
                <Download className="w-3.5 h-3.5" /> Export All
              </button>
            </div>
            {loading ? (
              <div className="p-6 space-y-3">{[1,2,3].map((i) => <div key={i} className="h-14 bg-white/3 rounded-xl animate-pulse" />)}</div>
            ) : transactions.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[11px] text-slate-700">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-white/4">
                {transactions.map((tx, i) => {
                  const date = tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }) : tx.date || '—';
                  const amount = tx.amount != null ? (typeof tx.amount === 'number' ? `$${(tx.amount / 100).toFixed(2)}` : tx.amount) : '—';
                  const status = tx.status || 'paid';
                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-white/2 transition-all group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white/4 border border-white/6 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">{tx.description || `INV-${tx.id}`}</p>
                        <p className="text-[10px] text-slate-700 font-mono">{date}</p>
                      </div>
                      <span className="text-sm font-black text-white">{amount}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase hidden sm:inline-flex ${status === 'completed' || status === 'paid' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'}`}>
                        {status}
                      </span>
                      <button className="p-1.5 text-slate-700 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100">
                        <Download className="w-4 h-4" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
