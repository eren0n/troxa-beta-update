import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  Zap, FolderKanban, Download, Plus, Clock, ChevronRight,
  ArrowUpRight, ArrowDownRight, Sparkles, Play, Eye,
  Users, CheckCircle2, ExternalLink, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { creativesApi, brandKitApi, activityApi } from '../../lib/api';

const weekData = [
  { day: 'Mon', gen: 0, exp: 0 },
  { day: 'Tue', gen: 0, exp: 0 },
  { day: 'Wed', gen: 0, exp: 0 },
  { day: 'Thu', gen: 0, exp: 0 },
  { day: 'Fri', gen: 0, exp: 0 },
  { day: 'Sat', gen: 0, exp: 0 },
  { day: 'Sun', gen: 0, exp: 0 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0c0f1a] border border-white/10 rounded-xl p-3 shadow-2xl">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{label}</p>
        {payload.map((p) => (
          <p key={p.name} className="text-xs font-bold" style={{ color: p.color }}>
            {p.name === 'gen' ? 'Generated' : 'Exported'}: <span className="text-white">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardHome() {
  const { user, credits, activeWorkspace, refreshCredits } = useAuth();
  const [creatives, setCreatives] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [chartData, setChartData] = useState(weekData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      try {
        const [gal, camps, js, analytics] = await Promise.allSettled([
          creativesApi.gallery(),
          brandKitApi.campaigns(),
          creativesApi.jobs(),
          activityApi.analytics(),
        ]);
        if (gal.status === 'fulfilled') setCreatives(gal.value?.results || gal.value || []);
        if (camps.status === 'fulfilled') setCampaigns(camps.value?.results || camps.value || []);
        if (js.status === 'fulfilled') setJobs(js.value?.results || js.value || []);
        if (analytics.status === 'fulfilled') {
          const daily = analytics.value?.daily || [];
          const last7 = daily.slice(-7);
          if (last7.length > 0) {
            const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            setChartData(last7.map((d) => ({
              day: DAY_ABBR[new Date(d.day).getDay()],
              gen: d.gen || 0,
              exp: d.exp || 0,
            })));
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [activeWorkspace]);

  const displayName = user
    ? (user.first_name || user.email?.split('@')[0] || 'there')
    : 'there';

  const creditBalance = credits?.balance ?? 0;
  const creditTotal = credits ? (credits.balance + (credits.used || 0)) : 10;
  const creditUsed = credits?.used ?? 0;
  const TIER_NAMES = { individual: 'Individual', team: 'Pro Team', enterprise: 'Enterprise', free: 'Free Trial' };
  const planName = (typeof credits?.plan === 'string' ? credits.plan : credits?.plan?.name)
    || TIER_NAMES[activeWorkspace?.tier] || 'Free Trial';

  const activeJobCount = jobs.filter((j) => j.status === 'running' || j.status === 'pending').length;

  const statCards = [
    {
      label: 'Total Generated',
      value: creatives.length,
      change: creatives.length > 0 ? `+${creatives.length}` : '0',
      up: true,
      icon: Zap,
      color: 'text-blue-400',
      bg: 'bg-blue-500/8',
      border: 'border-blue-500/15',
      sub: 'all time',
    },
    {
      label: 'Active Jobs',
      value: activeJobCount,
      change: activeJobCount > 0 ? `+${activeJobCount}` : '0',
      up: activeJobCount > 0,
      icon: Play,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/8',
      border: 'border-emerald-500/15',
      sub: 'running now',
    },
    {
      label: 'Campaigns',
      value: campaigns.length,
      change: `${campaigns.length}`,
      up: true,
      icon: FolderKanban,
      color: 'text-purple-400',
      bg: 'bg-purple-500/8',
      border: 'border-purple-500/15',
      sub: 'active',
    },
    {
      label: 'Credits Left',
      value: creditBalance,
      change: `${creditTotal > 0 ? Math.round((creditBalance / creditTotal) * 100) : 0}%`,
      up: creditBalance > 2,
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/8',
      border: 'border-amber-500/15',
      sub: 'remaining',
    },
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">
            Good morning, <span className="text-blue-400 capitalize">{displayName}</span>
          </h1>
          {loading
            ? <div className="h-4 w-56 bg-white/8 rounded animate-pulse mt-1" />
            : <p className="text-slate-500 text-sm mt-1">
                {activeJobCount > 0 ? (
                  <><span className="text-white font-bold">{activeJobCount} active job{activeJobCount !== 1 ? 's' : ''}</span> running · </>
                ) : null}
                <span className="text-white font-bold">{creditBalance} credits</span> remaining on <span className="text-white font-bold">{planName}</span>
              </p>
          }
        </div>
        <div className="flex gap-3">
          <Link
            to="/dashboard/create"
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            Generate New
          </Link>
          <button
            onClick={refreshCredits}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/8 border border-white/8 text-white rounded-xl font-bold text-sm transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="p-5 bg-[#0b0e1a] border border-white/6 hover:border-white/10 rounded-2xl group transition-all cursor-default"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-9 h-9 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              {loading
                ? <div className="h-3.5 w-10 bg-white/8 rounded animate-pulse" />
                : <div className={`flex items-center gap-1 text-[10px] font-black ${s.up ? 'text-emerald-400' : 'text-red-400'}`}>
                    {s.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {s.change}
                  </div>
              }
            </div>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">{s.label}</p>
            {loading
              ? <div className="h-7 w-14 bg-white/8 rounded-lg animate-pulse" />
              : <p className="text-2xl font-black text-white">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
            }
            <p className="text-[10px] text-slate-700 mt-1">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-[#0b0e1a] border border-white/6 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-black text-white">Generation Activity</h3>
              <p className="text-[11px] text-slate-600 mt-0.5">Last 7 days</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] text-slate-600 font-bold">Generated</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-[10px] text-slate-600 font-bold">Exported</span>
              </div>
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="genGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="day" stroke="transparent" tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }} tickLine={false} />
                <YAxis stroke="transparent" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.05)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="gen" stroke="#3b82f6" strokeWidth={2} fill="url(#genGrad)" />
                <Area type="monotone" dataKey="exp" stroke="#a855f7" strokeWidth={2} fill="url(#expGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Credits + Quick Actions */}
        <div className="space-y-4">
          {/* Credits */}
          <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-black text-white text-sm">Credit Usage</h4>
              <Link to="/dashboard/billing" className="text-[10px] text-blue-400 font-bold hover:text-blue-300 transition-colors">
                {credits?.plan?.tier === 'free' ? 'Upgrade' : 'Manage'}
              </Link>
            </div>
            <div className="flex items-end gap-2 mb-3">
              {loading
                ? <div className="h-8 w-24 bg-white/8 rounded-lg animate-pulse" />
                : <>
                    <span className="text-2xl font-black text-white">{creditUsed.toLocaleString()}</span>
                    <span className="text-slate-600 text-sm mb-0.5">/ {creditTotal.toLocaleString()}</span>
                  </>
              }
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              {loading
                ? <div className="h-full w-1/3 bg-white/8 rounded-full animate-pulse" />
                : <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${creditTotal > 0 ? (creditUsed / creditTotal) * 100 : 0}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                    className="h-full bg-linear-to-r from-blue-600 to-blue-400 rounded-full"
                  />
              }
            </div>
            {loading
              ? <div className="h-3 w-40 bg-white/8 rounded animate-pulse mt-2" />
              : <p className="text-[10px] text-slate-600 mt-2">{creditBalance.toLocaleString()} credits remaining · {planName}</p>
            }
          </div>

          {/* Quick Actions */}
          <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-5">
            <h4 className="font-black text-white text-sm mb-4">Quick Actions</h4>
            <div className="space-y-2">
              {[
                { label: 'New Generation', icon: Sparkles, to: '/dashboard/create', color: 'text-blue-400' },
                { label: 'View Gallery', icon: Eye, to: '/dashboard/creatives', color: 'text-purple-400' },
                { label: 'Brand Kit', icon: FolderKanban, to: '/dashboard/brand-kit', color: 'text-amber-400' },
                { label: 'Team Members', icon: Users, to: '/dashboard/team', color: 'text-emerald-400' },
              ].map((a, i) => (
                <Link
                  key={i}
                  to={a.to}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/4 border border-transparent hover:border-white/6 transition-all group"
                >
                  <div className="w-7 h-7 rounded-lg bg-white/4 flex items-center justify-center shrink-0">
                    <a.icon className={`w-3.5 h-3.5 ${a.color}`} />
                  </div>
                  <span className="text-sm font-bold text-slate-400 group-hover:text-white transition-colors">{a.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400 ml-auto transition-all group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns + Creatives Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Active Campaigns */}
        <div className="lg:col-span-2 bg-[#0b0e1a] border border-white/6 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-black text-white">Active Campaigns</h3>
            <Link to="/dashboard/brand-kit" className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
              All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-white/3 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-600">No campaigns yet</p>
              <Link to="/dashboard/brand-kit" className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block">Create one →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.slice(0, 4).map((c, i) => (
                <motion.div
                  key={c.id || i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/3 transition-all group cursor-pointer"
                >
                  <div className="w-2 h-2 rounded-full shrink-0 bg-emerald-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{c.name}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{c.creatives_count ?? 0} creatives</p>
                  </div>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    active
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Latest Creatives */}
        <div className="lg:col-span-3 bg-[#0b0e1a] border border-white/6 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-black text-white">Latest Creatives</h3>
            <Link to="/dashboard/creatives" className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
              Open Gallery <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square bg-white/3 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : creatives.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-600">No creatives yet</p>
              <Link to="/dashboard/create" className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block">Generate your first →</Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {creatives.slice(0, 4).map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + i * 0.07 }}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-white/4 border border-white/6 cursor-pointer"
                  >
                    <img
                      src={c.logo_applied_url || c.image_url}
                      alt={c.prompt?.slice(0, 30) || 'Creative'}
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <div className="flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        <span className="text-[8px] text-emerald-400 font-bold">Ready</span>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className="text-[8px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-md">NEW</span>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/4 hover:bg-white/6 border border-white/6 rounded-xl text-sm font-bold text-slate-400 hover:text-white transition-all">
                  <Download className="w-4 h-4" /> Export All
                </button>
                <Link to="/dashboard/creatives" className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600/10 hover:bg-blue-600/15 border border-blue-500/20 rounded-xl text-sm font-bold text-blue-400 hover:text-blue-300 transition-all">
                  View All <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
