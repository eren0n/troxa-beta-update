import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  Plus, SquarePlus, Sparkles, Video, Pencil, Palette, Cpu, Image, Building2,
  ChevronRight, ExternalLink, CheckCircle2, Download, RefreshCw, Lock,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { creativesApi } from '../../lib/api';
import { GLASS_STYLE } from '../../components/ui/GlassCard';

// Launchpad — every generation/editing tool gets a card here so Home reads
// as "start something" rather than a stats dashboard. Feature-gated cards
// stay clickable (the destination page itself renders the paywall), they
// just carry a small lock badge so the gate isn't a surprise.
const FEATURES = [
  { name: 'Generate',      desc: 'Create new ad creatives from a prompt',   icon: SquarePlus, to: '/dashboard/create-v2' },
  { name: 'Prompt Studio', desc: 'Fine-tune prompts with reference images', icon: Sparkles,   to: '/dashboard/prompt-studio' },
  { name: 'Make Video',    desc: 'Turn creatives into short-form video',    icon: Video,      to: '/dashboard/make-video' },
  { name: 'Edit',          desc: 'Touch up and resize existing creatives',  icon: Pencil,     to: '/dashboard/editor' },
  { name: 'Brand Kit',     desc: 'Brand assets, logos & campaigns',         icon: Palette,    to: '/dashboard/brand-kit',  lockKey: 'brand-kit' },
  { name: 'Automation',    desc: 'Recurring generation pipelines',         icon: Cpu,        to: '/dashboard/automation', lockKey: 'automation' },
  { name: 'Gallery',       desc: 'Browse & export every creative',         icon: Image,      to: '/dashboard/gallery' },
  { name: 'Workspace',     desc: 'Team, billing & integrations',           icon: Building2,  to: '/dashboard/workspace' },
];

const FREE_LOCKED = new Set(['brand-kit', 'automation']);
const INDIVIDUAL_LOCKED = new Set(['automation']);

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardHome() {
  const { user, credits, activeWorkspace, refreshCredits, isFreeTier, isIndividualTier } = useAuth();
  const [creatives, setCreatives] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      try {
        const [gal, js] = await Promise.allSettled([
          creativesApi.gallery(),
          creativesApi.jobs(),
        ]);
        if (gal.status === 'fulfilled') setCreatives(gal.value?.results || gal.value || []);
        if (js.status === 'fulfilled') setJobs(js.value?.results || js.value || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeWorkspace]);

  const displayName = user
    ? (user.first_name || user.email?.split('@')[0] || 'there')
    : 'there';

  const creditBalance = credits?.balance ?? 0;
  const TIER_NAMES = { individual: 'Individual', team: 'Pro Team', enterprise: 'Enterprise', free: 'Free Trial' };
  const planName = (typeof credits?.plan === 'string' ? credits.plan : credits?.plan?.name)
    || TIER_NAMES[activeWorkspace?.tier] || 'Free Trial';

  const activeJobCount = jobs.filter((j) => j.status === 'running' || j.status === 'pending').length;

  const isLocked = (lockKey) => !!lockKey && (
    (isFreeTier && FREE_LOCKED.has(lockKey)) || (isIndividualTier && INDIVIDUAL_LOCKED.has(lockKey))
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Banner */}
      <div style={GLASS_STYLE} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded-2xl px-6 py-5">
        <div>
          <h1 className="text-2xl font-black text-white">
            {greeting()}, <span className="text-blue-400 capitalize">{displayName}</span>
          </h1>
          {loading
            ? <div className="h-4 w-56 bg-white/8 rounded animate-pulse mt-1" />
            : <p className="text-slate-500 text-sm mt-1">
                {activeJobCount > 0 ? (
                  <><span className="text-white font-bold">{activeJobCount} active job{activeJobCount !== 1 ? 's' : ''}</span> running · </>
                ) : null}
                <span className="text-white font-bold">{creditBalance.toLocaleString()} credits</span> remaining on <span className="text-white font-bold">{planName}</span>
              </p>
          }
        </div>
        <div className="flex gap-3 shrink-0">
          <Link
            to="/dashboard/create-v2"
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            Generate New
          </Link>
        </div>
      </div>

      {/* Feature launchpad */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-white">Jump into</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => {
            const locked = isLocked(f.lockKey);
            return (
              <motion.div
                key={f.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={f.to}
                  style={GLASS_STYLE}
                  className="relative flex flex-col gap-3 p-5 rounded-2xl hover:border-white/18 group transition-all h-full"
                >
                  {locked && (
                    <Lock className="absolute top-4 right-4 w-3.5 h-3.5 text-slate-600" />
                  )}
                  <div className="w-10 h-10 rounded-xl bg-blue-500/8 border border-blue-500/15 flex items-center justify-center group-hover:bg-blue-500/15 transition-colors">
                    <f.icon className="w-4.5 h-4.5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white flex items-center gap-1">
                      {f.name}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug">{f.desc}</p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Latest Creatives */}
      <div style={GLASS_STYLE} className="rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-black text-white">Latest Creatives</h3>
            <p className="text-[11px] text-slate-600 mt-0.5">Your most recent generations</p>
          </div>
          <Link to="/dashboard/gallery" className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
            Open Gallery <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-square bg-white/3 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : creatives.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-600">No creatives yet</p>
            <Link to="/dashboard/create-v2" className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block">Generate your first →</Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {creatives.slice(0, 12).map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 * i }}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-white/4 border border-white/6 cursor-pointer"
                >
                  <img
                    src={c.proxy_url || c.image_url}
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
                </motion.div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Link to="/dashboard/gallery" className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600/10 hover:bg-blue-600/15 border border-blue-500/20 rounded-xl text-sm font-bold text-blue-400 hover:text-blue-300 transition-all">
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
