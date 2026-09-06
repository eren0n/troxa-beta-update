import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3, Search, Download,
  Sparkles, Users, Package, Cpu, Settings,
  Clock, ChevronRight, MoreHorizontal
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { activityApi } from '../../lib/api';
import { GLASS_STYLE } from '../../components/ui/GlassCard';
import { useTheme } from '../../contexts/ThemeContext';


const EVENT_TYPE_MAP = {
  'creative.generated': { icon: Sparkles, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', type: 'generation' },
  'creative.exported':  { icon: Package,  color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', type: 'export' },
  'brand_kit.updated':  { icon: Settings, color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', type: 'system' },
  'team.member_added':  { icon: Users,    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', type: 'team' },
  'team.invite_sent':   { icon: Users,    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', type: 'team' },
  'automation.run':     { icon: Cpu,      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', type: 'ai' },
  'automation.created': { icon: Cpu,      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', type: 'ai' },
  'system.update':      { icon: Settings, color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', type: 'system' },
  default:              { icon: Clock,    color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', type: 'system' },
};

function formatRelativeTime(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Yesterday';
  return `${diffD}d ago`;
}

const filterTypes = ['All', 'generation', 'export', 'system', 'ai', 'team'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="border border-white/10 rounded-xl p-3 shadow-2xl" style={{ background: 'var(--dropdown-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{label}</p>
        {payload.map((p) => (
          <p key={p.name} className="text-xs font-bold" style={{ color: p.color }}>
            {p.name === 'gen' ? 'Generated' : p.name === 'exp' ? 'Exported' : 'Requests'}: <span className="text-white">{p.value.toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Activity() {
  const { activeWorkspace } = useAuth();
  const { colorMode } = useTheme();
  const chartGrid   = colorMode === 'dark' ? 'rgba(255,255,255,0.04)' : colorMode === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(180,90,30,0.08)';
  const chartTick   = colorMode === 'dark' ? '#475569' : colorMode === 'light' ? '#64748b' : '#9a7050';
  const chartCursor = colorMode === 'dark' ? 'rgba(255,255,255,0.05)' : colorMode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(180,90,30,0.07)';
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [period, setPeriod] = useState('7d');
  const [logs, setLogs] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) return;
    setLoading(true);
    Promise.allSettled([
      activityApi.events({ period }),
      activityApi.analytics(),
    ]).then(([eventsRes, analyticsRes]) => {
      if (eventsRes.status === 'fulfilled') {
        const raw = eventsRes.value?.results || eventsRes.value || [];
        setLogs(raw.map((event) => {
          const mapping = EVENT_TYPE_MAP[event.event_type] || EVENT_TYPE_MAP.default;
          const userName = event.user
            ? typeof event.user === 'string' ? event.user : `${event.user.first_name || ''} ${event.user.last_name || ''}`.trim() || event.user.email || 'User'
            : 'System';
          return {
            id: event.id,
            user: userName,
            action: event.action || event.description || event.event_type,
            campaign: event.campaign || event.metadata?.campaign || '—',
            time: formatRelativeTime(event.created_at),
            type: mapping.type,
            icon: mapping.icon,
            color: mapping.color,
          };
        }));
      }
      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value);
      }
      setLoading(false);
    });
  }, [activeWorkspace, period]);

  const statCards = [
    { label: 'Total Events', value: analytics ? analytics.total_events.toLocaleString() : '—', icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-500/8', border: 'border-blue-500/15' },
    { label: 'Creatives Generated', value: analytics ? analytics.generated.toLocaleString() : '—', icon: Sparkles, color: 'text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/15' },
    { label: 'Creatives Exported', value: analytics ? analytics.exported.toLocaleString() : '—', icon: Package, color: 'text-purple-400', bg: 'bg-purple-500/8', border: 'border-purple-500/15' },
    { label: 'Automation Runs', value: analytics ? analytics.automation_runs.toLocaleString() : '—', icon: Cpu, color: 'text-amber-400', bg: 'bg-amber-500/8', border: 'border-amber-500/15' },
  ];

  const areaData = analytics?.daily?.length
    ? analytics.daily.map((d) => ({ day: d.day.slice(5), gen: d.gen, exp: d.exp }))
    : [];

  const monthlyData = analytics?.monthly?.length
    ? analytics.monthly.map((m) => ({ month: m.month, requests: m.count }))
    : [];

  const filtered = logs.filter((l) => {
    const matchType = activeFilter === 'All' || l.type === activeFilter;
    const matchSearch = l.user.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Activity & Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time infrastructure monitoring and workspace event stream</p>
        </div>
        <div className="flex gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-sm border border-white/8 text-slate-400 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition-all"
            style={{ background: 'var(--bg-input)' }}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="12m">Last 12 Months</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/8 border border-white/8 text-slate-400 hover:text-white rounded-xl text-sm font-bold transition-all">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} style={GLASS_STYLE} className="p-5 rounded-2xl">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-9 h-9 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
            </div>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">{s.label}</p>
            {loading
              ? <div className="h-7 w-14 bg-white/8 rounded-lg animate-pulse" />
              : <p className="text-2xl font-black text-white">{s.value}</p>
            }
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div style={GLASS_STYLE} className="lg:col-span-3 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-black text-white">Generation vs Export</h3>
              <p className="text-[11px] text-slate-600 mt-0.5">Daily breakdown</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-[10px] text-slate-600 font-bold">Generated</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500" /><span className="text-[10px] text-slate-600 font-bold">Exported</span></div>
            </div>
          </div>
          <div className="h-56">
            {loading ? (
              <div className="h-full flex items-end gap-1.5 px-1">
                {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
                  <div key={i} className="flex-1 bg-white/6 rounded-t animate-pulse" style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />
                ))}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="actGenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="actExpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                  <XAxis dataKey="day" stroke="transparent" tick={{ fill: chartTick, fontSize: 10, fontWeight: 700 }} tickLine={false} />
                  <YAxis stroke="transparent" tick={{ fill: chartTick, fontSize: 10 }} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: chartCursor }} />
                  <Area type="monotone" dataKey="gen" stroke="var(--accent)" strokeWidth={2} fill="url(#actGenGrad)" />
                  <Area type="monotone" dataKey="exp" stroke="#a855f7" strokeWidth={2} fill="url(#actExpGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={GLASS_STYLE} className="lg:col-span-2 rounded-2xl p-6">
          <div className="mb-6">
            <h3 className="font-black text-white">Monthly Requests</h3>
            <p className="text-[11px] text-slate-600 mt-0.5">API calls per month</p>
          </div>
          <div className="h-56">
            {loading ? (
              <div className="h-full flex items-end gap-2 px-1">
                {[55, 75, 40, 90, 60, 80].map((h, i) => (
                  <div key={i} className="flex-1 bg-white/6 rounded-t animate-pulse" style={{ height: `${h}%`, animationDelay: `${i * 100}ms` }} />
                ))}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                  <XAxis dataKey="month" stroke="transparent" tick={{ fill: chartTick, fontSize: 10, fontWeight: 700 }} tickLine={false} />
                  <YAxis stroke="transparent" tick={{ fill: chartTick, fontSize: 10 }} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: chartCursor }} />
                  <Bar dataKey="requests" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Event Stream */}
      <div style={GLASS_STYLE} className="rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-white">Event Stream</h3>
            <p className="text-[11px] text-slate-600 mt-0.5">{filtered.length} events shown</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input
                type="text"
                placeholder="Search events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-52 bg-white/5 border border-white/8 focus:border-blue-500 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white outline-none transition-all placeholder:text-slate-700"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {filterTypes.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeFilter === f ? 'bg-blue-600 text-white' : 'bg-white/5 border border-white/8 text-slate-500 hover:text-white'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map((i) => <div key={i} className="h-14 bg-white/3 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="w-8 h-8 text-slate-800 mx-auto mb-3" />
            <p className="text-[11px] text-slate-700">No events found</p>
          </div>
        ) : (
          <div className="divide-y divide-white/4">
            <AnimatePresence mode="popLayout">
              {filtered.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-white/2 transition-all group"
                >
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${log.color}`}>
                    <log.icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white truncate">{log.action}</p>
                      {log.campaign !== '—' && (
                        <span className="text-[9px] bg-white/5 border border-white/8 text-slate-500 px-2 py-0.5 rounded-md font-bold shrink-0 hidden sm:inline-flex">{log.campaign}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{log.user}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border hidden sm:inline-flex ${log.color}`}>{log.type}</span>
                    <span className="text-[10px] text-slate-700 font-mono">{log.time}</span>
                    <button className="p-1.5 text-slate-700 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <div className="p-4 border-t border-white/5 flex items-center justify-between">
          <p className="text-[11px] text-slate-700">Showing {filtered.length} of {logs.length} events</p>
          <button className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
            Load more <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
