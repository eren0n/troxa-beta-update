import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  SquarePlus, Sparkles, Video, Pencil, Palette, Cpu, Image, Building2,
  ChevronRight, ArrowUpRight, Lock, Coins, Play, ChevronsLeftRight, Plus, UserPlus,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBrandIdentity } from '../../contexts/BrandIdentityContext';
import { PALETTE_ROLES, fontStack, ensureFontLoaded } from '../../lib/brandIdentity';
import { creativesApi, brandKitApi, teamApi } from '../../lib/api';
import { GLASS_STYLE } from '../../components/ui/GlassCard';
import { CreativeImg } from '../../components/ui/CreativeImg';

// Home is laid out as two offset rows rather than one flat grid:
//   top    — the four creation tools as feature cards, the rest as filler
//            pills (left, narrower) · latest creatives (right, wider)
//   bottom — brand stage (left, wider) · workspace credits + team (right)
// The split flips between rows so the page zig-zags instead of stacking
// on a centre line. Feature-gated cards stay clickable (the destination
// renders the paywall); they just carry a lock badge.

// Secondary destinations — small pills under the feature cards, so all
// eight dock destinations are still one click from Home.
const FILLER_TABS = [
  { name: 'Gallery',    icon: Image,     to: '/dashboard/gallery' },
  { name: 'Brand Kit',  icon: Palette,   to: '/dashboard/brand-kit',  lockKey: 'brand-kit' },
  { name: 'Automation', icon: Cpu,       to: '/dashboard/automation', lockKey: 'automation' },
  { name: 'Workspace',  icon: Building2, to: '/dashboard/workspace' },
];

const FREE_LOCKED = new Set(['brand-kit', 'automation']);
const INDIVIDUAL_LOCKED = new Set(['automation']);

// Latest creatives: one feature tile (2×2) plus eight small ones fills a
// 4-column grid (split layout) or a 6-column one (stacked, full width)
// exactly — anything past that is a "Show more" to the gallery.
const CREATIVE_LIMIT = 9;
const MEMBER_LIMIT = 5;

const TIER_NAMES = { individual: 'Individual', team: 'Pro Team', enterprise: 'Enterprise', free: 'Free Trial' };

const CHIP = 'inline-flex items-baseline gap-1 rounded-full border px-1.5 mx-0.5 bg-blue-500/15 text-blue-300 border-blue-400/40';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const assetUrl = (a) => a.file_url || a.url;

// Cards navigate on click instead of being <a href>s, so hovering one
// doesn't pop the browser's URL preview in the corner. Enter still works.
function Go({ to, className = '', style, children }) {
  const navigate = useNavigate();
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate(to)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); navigate(to); } }}
      className={`cursor-pointer ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

// ── Feature cards ────────────────────────────────────────────────────────
// Each tool pitches itself with a small visual of what it does, built from
// the workspace's own recent creatives where there are any.

function FeatureShell({ to, className = '', index, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileHover={{ y: -3 }}
      className={`min-w-0 min-h-0 ${className}`}
    >
      <Go
        to={to}
        style={GLASS_STYLE}
        className="relative flex h-full rounded-2xl overflow-hidden group transition-colors hover:border-blue-500/30"
      >
        {children}
      </Go>
    </motion.div>
  );
}

function CardHead({ icon: Icon, title, pitch, big }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2.5">
        <div className={`rounded-xl bg-blue-500/12 border border-blue-500/25 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors ${big ? 'w-10 h-10' : 'w-8 h-8'}`}>
          <Icon className={`${big ? 'w-5 h-5' : 'w-4 h-4'} text-blue-400`} />
        </div>
        <h4 className={`font-black text-white truncate ${big ? 'text-xl' : 'text-sm'}`}>{title}</h4>
      </div>
      <p className={`text-slate-400 leading-snug ${big ? 'text-[13px] mt-3 max-w-64' : 'text-[11px] mt-2'}`}>{pitch}</p>
    </div>
  );
}

function Thumb({ id, className = '' }) {
  return id
    ? <CreativeImg creativeId={id} alt="" loading="lazy" className={`w-full h-full object-cover ${className}`} />
    : <div className={`w-full h-full bg-linear-to-br from-blue-500/25 via-blue-500/5 to-transparent ${className}`} />;
}

function GenerateCard({ ids, index }) {
  // Offset/rotation live in CSS vars so hover can spread the fan.
  const fan = [
    '[--fx:-34px] [--rot:-10deg] group-hover:[--fx:-50px] group-hover:[--rot:-15deg]',
    '[--fx:34px] [--rot:8deg] group-hover:[--fx:50px] group-hover:[--rot:13deg]',
    '[--fx:0px] [--rot:0deg] group-hover:[--fx:0px] group-hover:[--rot:-2deg]',
  ];
  return (
    <FeatureShell to="/dashboard/create-v2" index={index} className="sm:col-span-6">
      <div className="absolute -top-20 -left-10 w-72 h-72 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
      <div className="relative flex-1 flex flex-col justify-between p-6 min-w-0">
        <div>
          <span className="inline-block mb-3 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-[9px] font-black uppercase tracking-widest text-blue-300">
            Start here
          </span>
          <CardHead icon={SquarePlus} title="Generate creatives" big
            pitch="Pick references, choose your formats and get on-brand ad statics in one go." />
        </div>
        <span className="mt-4 self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 group-hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-600/25 transition-colors">
          Start generating <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
      {/* Fanned stack of recent output — spreads on hover */}
      <div className="relative hidden sm:block w-48 shrink-0 mr-6">
        {fan.map((cls, i) => (
          <div
            key={i}
            className={`absolute top-1/2 left-1/2 w-24 aspect-4/5 rounded-xl overflow-hidden border border-white/15 shadow-2xl shadow-black/50 transition-transform duration-500 ease-out ${cls}`}
            style={{ transform: 'translate(calc(-50% + var(--fx)), -50%) rotate(var(--rot))' }}
          >
            <Thumb id={ids[i]} />
          </div>
        ))}
      </div>
    </FeatureShell>
  );
}

function PromptStudioCard({ index }) {
  return (
    <FeatureShell to="/dashboard/prompt-studio" index={index} className="sm:col-span-4">
      <div className="flex-1 flex flex-col justify-between gap-3 p-4 min-w-0">
        <CardHead icon={Sparkles} title="Prompt Studio" pitch="Write the brief your way and tag brand assets right in the sentence." />
        <div className="rounded-xl bg-black/30 border border-white/6 px-3 py-2 text-[11px] leading-relaxed text-slate-400 whitespace-nowrap overflow-hidden mask-[linear-gradient(to_right,black_85%,transparent)]">
          Model holding
          <span className={CHIP}><span className="text-[8px] font-black uppercase opacity-60">CTA</span><b>Join Now</b></span>
          next to
          <span className={CHIP}><span className="text-[8px] font-black uppercase opacity-60">Logo</span><b>Primary</b></span>
          <span className="inline-block w-px h-3 bg-blue-400 align-middle ml-0.5 animate-pulse" />
        </div>
      </div>
    </FeatureShell>
  );
}

function MakeVideoCard({ id, index }) {
  return (
    <FeatureShell to="/dashboard/make-video" index={index} className="sm:col-span-2 sm:row-span-2">
      <div className="flex-1 flex flex-col gap-3 p-4 min-w-0">
        <CardHead icon={Video} title="Make Video" pitch="Turn any creative into a short video." />
        <div className="flex-1 min-h-32 flex items-center justify-center">
          <div className="relative h-full max-h-56 aspect-9/16 rounded-xl overflow-hidden border border-white/12 shadow-xl shadow-black/40">
            <Thumb id={id} className="group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
              <span className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play className="w-4 h-4 text-slate-900 fill-current ml-0.5" />
              </span>
            </div>
            <div className="absolute inset-x-2 bottom-2 h-0.5 rounded-full bg-white/25 overflow-hidden">
              <motion.div className="h-full bg-white" initial={{ width: '0%' }} animate={{ width: '100%' }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} />
            </div>
          </div>
        </div>
      </div>
    </FeatureShell>
  );
}

function EditCard({ id, index }) {
  return (
    <FeatureShell to="/dashboard/editor" index={index} className="sm:col-span-4">
      <div className="flex-1 flex items-stretch gap-4 p-4 min-w-0">
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <CardHead icon={Pencil} title="Edit" pitch="Touch up, resize and rework creatives you already have." />
        </div>
        {/* Before / after split */}
        <div className="relative w-24 shrink-0 rounded-xl overflow-hidden border border-white/12">
          <Thumb id={id} />
          <div className="absolute inset-0" style={{ clipPath: 'inset(0 50% 0 0)' }}>
            <Thumb id={id} className="grayscale brightness-75" />
          </div>
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-white/90">
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow flex items-center justify-center">
              <ChevronsLeftRight className="w-2.5 h-2.5 text-slate-900" />
            </span>
          </div>
        </div>
      </div>
    </FeatureShell>
  );
}

function FillerPill({ tab, locked, index }) {
  const Icon = tab.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + index * 0.04 }} className="min-w-0">
      <Go to={tab.to} style={GLASS_STYLE}
        className="flex items-center gap-2 h-11 px-3 rounded-xl group transition-colors hover:border-white/18">
        <Icon className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors shrink-0" />
        <span className="text-xs font-bold text-slate-300 group-hover:text-white truncate flex-1">{tab.name}</span>
        {locked && <Lock className="w-3 h-3 text-slate-600 shrink-0" />}
      </Go>
    </motion.div>
  );
}

function SectionHeader({ title, to, linkLabel }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-black text-white">{title}</h3>
      {to && (
        <Go to={to} className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
          {linkLabel} <ArrowUpRight className="w-3 h-3" />
        </Go>
      )}
    </div>
  );
}

export default function DashboardHome() {
  const { user, credits, activeWorkspace, isFreeTier, isIndividualTier } = useAuth();
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brandLogo, setBrandLogo] = useState(null);
  const [members, setMembers] = useState(null);

  const isLocked = (lockKey) => !!lockKey && (
    (isFreeTier && FREE_LOCKED.has(lockKey)) || (isIndividualTier && INDIVIDUAL_LOCKED.has(lockKey))
  );
  const brandKitLocked = isLocked('brand-kit');

  useEffect(() => {
    if (!activeWorkspace) return;
    creativesApi.gallery()
      .then((res) => setCreatives(res?.results || res || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    teamApi.members()
      .then((res) => setMembers(res?.results || res || []))
      .catch(() => setMembers([]));
  }, [activeWorkspace]);

  useEffect(() => {
    if (!activeWorkspace || brandKitLocked) return;
    brandKitApi.logos()
      .then((res) => {
        const list = res?.results || res || [];
        setBrandLogo(list.find((l) => l.is_primary) || list[0] || null);
      })
      .catch(() => {});
  }, [activeWorkspace, brandKitLocked]);

  const displayName = user
    ? (user.first_name || user.email?.split('@')[0] || 'there')
    : 'there';

  const shownCreatives = creatives.slice(0, CREATIVE_LIMIT);
  // Feature-card visuals draw on recent stills (not videos), cycling if
  // there are only a few; null falls back to a gradient placeholder.
  const stills = creatives.filter((c) => c.media_type !== 'Video');
  const still = (i) => (stills.length ? stills[i % stills.length].id : null);

  return (
    <div className="space-y-8 pb-20">
      <h1 className="text-xl md:text-2xl font-black text-white">
        {greeting()}, <span className="text-blue-400 capitalize">{displayName}</span>
      </h1>

      {/* ── Row 1: create · latest creatives ──
          Split only from xl up (below that the feature cards get too
          narrow for their copy and stack above the creatives instead);
          24 columns so the offset can ease from 11/13 to 10/14. */}
      <div className="grid grid-cols-1 xl:grid-cols-24 gap-6">
        <section className="xl:col-span-11 2xl:col-span-10 flex flex-col">
          <SectionHeader title="Create" />
          {/*  Generate  Generate  Generate  Generate  Generate  Generate
               Prompt Studio ·························  Make Video ····
               Edit ··································  Make Video ····  */}
          <div className="grid grid-cols-1 sm:grid-cols-6 sm:grid-rows-[minmax(11.5rem,1.35fr)_minmax(8.5rem,1fr)_minmax(8.5rem,1fr)] gap-3 flex-1">
            <GenerateCard ids={[still(1), still(2), still(0)]} index={0} />
            <PromptStudioCard index={1} />
            <MakeVideoCard id={still(3)} index={2} />
            <EditCard id={still(4)} index={3} />
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FILLER_TABS.map((t, i) => (
              <FillerPill key={t.name} tab={t} index={i} locked={isLocked(t.lockKey)} />
            ))}
          </div>
        </section>

        <section className="xl:col-span-13 2xl:col-span-14 flex flex-col">
          <SectionHeader title="Latest Creatives" to="/dashboard/gallery" linkLabel="Open Gallery" />
          {loading ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-4 gap-3">
              {Array.from({ length: CREATIVE_LIMIT }).map((_, i) => (
                <div key={i} className={`bg-white/3 rounded-xl animate-pulse aspect-square ${i === 0 ? 'col-span-2 row-span-2' : ''}`} />
              ))}
            </div>
          ) : creatives.length === 0 ? (
            <div style={GLASS_STYLE} className="flex-1 rounded-2xl flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-slate-600">No creatives yet</p>
              <Go to="/dashboard/create-v2" className="text-xs text-blue-400 hover:text-blue-300 mt-1">Generate your first →</Go>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-4 gap-3">
                {shownCreatives.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.04 * i }}
                    className={i === 0 ? 'col-span-2 row-span-2' : ''}
                  >
                    <Go
                      to="/dashboard/gallery"
                      className="group relative block w-full aspect-square rounded-xl overflow-hidden bg-white/4 border border-white/6"
                    >
                      <CreativeImg
                        creativeId={c.id}
                        alt={c.name || 'Creative'}
                        loading="lazy"
                        className="w-full h-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                      />
                      {i === 0 && c.name && (
                        <div className="absolute inset-x-0 bottom-0 p-3 bg-linear-to-t from-black/80 to-transparent">
                          <p className="text-xs font-bold truncate" style={{ color: '#fff' }}>{c.name}</p>
                        </div>
                      )}
                    </Go>
                  </motion.div>
                ))}
              </div>
              {creatives.length > CREATIVE_LIMIT && (
                <Go
                  to="/dashboard/gallery"
                  className="mt-3 self-end flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Show more <ChevronRight className="w-3.5 h-3.5" />
                </Go>
              )}
            </>
          )}
        </section>
      </div>

      {/* ── Row 2: brand stage · workspace — the mirror of row 1's offset ── */}
      <div className="grid grid-cols-1 lg:grid-cols-24 gap-6">
        <section className="lg:col-span-14 xl:col-span-13 2xl:col-span-14 flex flex-col">
          <SectionHeader title="Your Brand" to="/dashboard/brand-kit" linkLabel="Open Brand Kit" />
          <BrandStage locked={brandKitLocked} logo={brandLogo} stills={[still(0), still(1), still(2)]} workspaceName={activeWorkspace?.name} />
        </section>

        <section className="lg:col-span-10 xl:col-span-11 2xl:col-span-10 flex flex-col">
          <SectionHeader title="Workspace" to="/dashboard/workspace" linkLabel="Manage" />
          <WorkspaceCard members={members} credits={credits} workspace={activeWorkspace} />
        </section>
      </div>
    </div>
  );
}

// ── Brand stage ──────────────────────────────────────────────────────────
// Brand Kit shown as the brand itself rather than an inventory of it: a
// stage lit in the palette's own colours, the logo (or the workspace name
// set in the brand's heading font), the palette and type pairing, and the
// workspace's recent output tilted in beside it. The stage is always dark
// whatever the app theme — it's a brand surface, not app chrome — so its
// text colours are set inline instead of through the theme tokens.

const BOARD_LABEL = 'text-[9px] font-black uppercase tracking-widest';
const DEFAULT_STAGE = ['#3b82f6', '#8b5cf6', '#06b6d4'];

function pickPreset(list) {
  return list.find((p) => p.active) || list[0] || null;
}

// Slow drifting light blobs in the given colours.
function StageLights({ colors }) {
  const spots = [
    { c: colors[0], cls: 'w-80 h-80 -top-24 -left-16', x: [0, 40, 0], y: [0, 30, 0] },
    { c: colors[1], cls: 'w-72 h-72 -bottom-28 left-1/3', x: [0, -30, 0], y: [0, -20, 0] },
    { c: colors[2], cls: 'w-64 h-64 -top-16 right-0', x: [0, -20, 0], y: [0, 40, 0] },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ background: '#06080f' }}>
      {spots.map((s, i) => (
        <motion.div key={i} className={`absolute rounded-full blur-3xl opacity-60 ${s.cls}`}
          style={{ background: s.c }}
          animate={{ x: s.x, y: s.y }}
          transition={{ duration: 14 + i * 3, repeat: Infinity, ease: 'easeInOut' }} />
      ))}
      <div className="absolute inset-0 bg-linear-to-r from-black/55 via-black/25 to-black/10" />
    </div>
  );
}

function BrandStage({ locked, logo, stills, workspaceName }) {
  const { palettePresets = [], typographyPresets = [] } = useBrandIdentity() || {};
  const palette = pickPreset(palettePresets);
  const type = pickPreset(typographyPresets);

  useEffect(() => {
    if (type?.heading) ensureFontLoaded(type.heading);
    if (type?.body) ensureFontLoaded(type.body);
  }, [type?.heading, type?.body]);

  const colors = palette?.colors || [];
  // Light the stage with the saturated roles first; neutrals make poor light.
  const byRole = (r) => colors.find((c) => c.role === r)?.hex;
  const lit = [byRole('primary'), byRole('accent'), byRole('secondary'), ...colors.map((c) => c.hex)].filter(Boolean);
  const lights = lit.length ? [lit[0], lit[1] || lit[0], lit[2] || lit[0]] : DEFAULT_STAGE;
  const headingFont = type?.heading ? fontStack(type.heading) : undefined;

  if (locked) {
    return (
      <Go to="/dashboard/brand-kit" className="relative flex-1 min-h-72 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
        <StageLights colors={DEFAULT_STAGE} />
        <div className="relative text-center px-6" style={{ color: '#fff' }}>
          <div className="w-11 h-11 mx-auto rounded-xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center mb-3">
            <Lock className="w-5 h-5" />
          </div>
          <p className="text-base font-black">Give every creative your brand</p>
          <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Brand Kit keeps your logo, palette and fonts in one place. Available on paid plans.
          </p>
        </div>
      </Go>
    );
  }

  return (
    <Go to="/dashboard/brand-kit"
      className="group relative flex-1 min-h-72 rounded-2xl overflow-hidden border border-white/10 flex"
    >
      <StageLights colors={lights} />

      <div className="relative flex-1 min-w-0 flex flex-col justify-between gap-6 p-6" style={{ color: '#fff' }}>
        <div className="min-w-0">
          {logo ? (
            <img src={assetUrl(logo)} alt="Logo"
              className="max-h-16 max-w-[80%] object-contain object-left drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]" />
          ) : (
            <p className="text-4xl font-black tracking-tight truncate" style={{ fontFamily: headingFont }}>
              {workspaceName || 'Your brand'}
            </p>
          )}
          <p className="text-sm mt-3 max-w-sm" style={{ color: 'rgba(255,255,255,0.72)', fontFamily: type?.body ? fontStack(type.body) : undefined }}>
            The logo, colours and type every generation follows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {/* Palette */}
          {colors.length > 0 ? (
            <div className="flex -space-x-1.5">
              {colors.slice(0, 6).map((c) => (
                <span key={c.id || c.hex} title={`${c.hex} · ${PALETTE_ROLES.find((r) => r.key === c.role)?.label || c.role}`}
                  className="w-8 h-8 rounded-full border-2 border-white/25 shadow-lg hover:-translate-y-1 transition-transform"
                  style={{ background: c.hex }} />
              ))}
            </div>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>
              <Plus className="w-3 h-3" /> Add a palette
            </span>
          )}

          <span className="w-px h-8 bg-white/20" />

          {/* Type pairing */}
          {type ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-3xl leading-none font-bold" style={{ fontFamily: headingFont }}>Aa</span>
              <div className="min-w-0 leading-tight">
                <p className="text-[11px] font-bold truncate">{type.heading}</p>
                <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>{type.body}</p>
              </div>
            </div>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>
              <Plus className="w-3 h-3" /> Pick fonts
            </span>
          )}
        </div>
      </div>

      {/* Recent output, tilted in — straightens on hover */}
      <div className="relative hidden sm:flex items-center w-60 lg:w-64 shrink-0 pr-6" style={{ perspective: '900px' }}>
        {[0, 1, 2].map((i) => (
          <div key={i}
            className="absolute w-32 aspect-4/5 rounded-xl overflow-hidden border border-white/20 shadow-2xl shadow-black/60 transition-transform duration-700 ease-out [--ry:-24deg] group-hover:[--ry:-10deg]"
            style={{
              right: `${24 + i * 44}px`,
              zIndex: 3 - i,
              transform: `rotateY(var(--ry)) translateZ(${-i * 40}px)`,
              opacity: 1 - i * 0.18,
            }}>
            <Thumb id={stills[i]} />
          </div>
        ))}
      </div>
    </Go>
  );
}

// ── Workspace card ───────────────────────────────────────────────────────
// Credits as a gauge and the team as faces; managing either is one tap to
// the matching Workspace tab. The card itself isn't a link — it holds two
// explicit actions instead.

function memberName(m) {
  if (m.name) return m.name;
  const u = m.user || m;
  return `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Member';
}

function initialsOf(name) {
  return name.split(/[\s@.]+/).filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

// Stable per-person hue so avatars are told apart at a glance.
function hueOf(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function CreditRing({ pct, low }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90 shrink-0">
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-white/8" />
      <motion.circle
        cx="50" cy="50" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
        stroke={low ? '#fbbf24' : 'var(--accent)'}
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - (pct ?? 0) / 100) }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      />
    </svg>
  );
}

function WorkspaceCard({ members, credits, workspace }) {
  const balance = credits?.balance ?? 0;
  const total = credits?.total ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((balance / total) * 100)) : null;
  const low = pct !== null && pct < 15;
  const planName = (typeof credits?.plan === 'string' ? credits.plan : credits?.plan?.name)
    || TIER_NAMES[workspace?.tier] || 'Free Trial';
  const people = (members || []).map((m) => ({ name: memberName(m), avatar: m.avatar_url }));
  const names = people.map((p) => p.name);

  return (
    <div style={GLASS_STYLE} className="flex-1 rounded-2xl p-5 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-black text-white truncate">{workspace?.name || 'Your workspace'}</p>
        </div>
        <span className="shrink-0 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-wider">
          {planName}
        </span>
      </div>

      {/* Credits */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <CreditRing pct={pct} low={low} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xl font-black text-white leading-none">{balance.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">credits</p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-300">
            {pct !== null ? <>{pct}% left</> : 'Credits remaining'}
          </p>
          {total > 0 && <p className="text-[11px] text-slate-500 mt-0.5">of {total.toLocaleString()} this cycle</p>}
          {low && <p className="text-[11px] font-bold text-amber-400 mt-1">Running low</p>}
          <Go to="/dashboard/workspace?tab=billing"
            className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors ${
              low ? 'bg-amber-400 text-slate-900 hover:bg-amber-300' : 'bg-white/6 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
            }`}>
            <Coins className="w-3.5 h-3.5" /> {low ? 'Top up' : 'Billing'}
          </Go>
        </div>
      </div>

      <div className="h-px bg-white/6" />

      {/* Team */}
      <div className="flex items-center gap-4">
        {members === null ? (
          <div className="h-10 flex-1 rounded-lg bg-white/3 animate-pulse" />
        ) : (
          <>
            <div className="flex -space-x-2.5 shrink-0">
              {people.slice(0, MEMBER_LIMIT).map(({ name: n, avatar }, i) => (
                avatar ? (
                  <img key={i} src={avatar} alt={n} title={n}
                    className="w-10 h-10 rounded-full object-cover"
                    style={{ boxShadow: '0 0 0 2px var(--bg-base)' }} />
                ) : (
                  <span key={i} title={n}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-black"
                    style={{
                      background: `hsl(${hueOf(n)} 55% 22%)`,
                      color: `hsl(${hueOf(n)} 85% 78%)`,
                      boxShadow: '0 0 0 2px var(--bg-base)',
                    }}>
                    {initialsOf(n)}
                  </span>
                )
              ))}
              {names.length > MEMBER_LIMIT && (
                <span className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black bg-white/8 text-slate-400"
                  style={{ boxShadow: '0 0 0 2px var(--bg-base)' }}>
                  +{names.length - MEMBER_LIMIT}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-300">{names.length} member{names.length !== 1 ? 's' : ''}</p>
              <p className="text-[11px] text-slate-500 truncate">
                {names.slice(0, 2).map((n) => n.split(' ')[0]).join(', ')}{names.length > 2 ? ` +${names.length - 2}` : ''}
              </p>
            </div>
            <Go to="/dashboard/workspace?tab=team"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black bg-blue-600 hover:bg-blue-500 text-white transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> Invite
            </Go>
          </>
        )}
      </div>
    </div>
  );
}
