import { useRef } from 'react';
import {
  motion, useScroll, useTransform, useSpring, AnimatePresence
} from 'motion/react';
import {
  ArrowRight, Upload, Sparkles, Layers, CircleCheck, Zap, Users,
  ShieldCheck, Image as ImageIcon, Download, Layout, ShieldAlert,
  Trophy, Gamepad2, TrendingUp, Users2, Palette, Target, BarChart3,
  Globe, Calendar, Gift, Monitor, Share2, MapPin, ArrowUpRight,
  Check, HelpCircle, Heart, Star, ChevronDown, Instagram, Facebook, Twitter, Youtube, Linkedin, BadgeCheck, Images,
  Video, Workflow
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {ThreadsIcon, TikTokIcon, MetaIcon, XIcon, CloudSync, Google} from '../components/layout/Icons';

// â”€â”€â”€ Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


const brands = [
  'WANNA PARLAY', 'THRILLZZ', 'SPINPALS', 'BETWAVE', 'JACKPOT MEDIA',
  'ODDSCRAFT', 'CASINO LOOP', 'BETLANCER', 'PROMO KINGS', 'REEL FORCE',
];

const brandsWLogos = [
  { name: 'INSTAGRAM', logo: Instagram },
  { name: 'FACEBOOK', logo: Facebook },
  { name: 'X / TWITTER', logo: XIcon },
  { name: 'TIKTOK', logo: TikTokIcon },
  { name: 'THREADS', logo: ThreadsIcon },
  { name: 'YOUTUBE', logo: Youtube },
  { name: 'LINKEDIN', logo: Linkedin },
  { name: 'META', logo: MetaIcon },
  { name: 'GOOGLE', logo: Google}
];

const featuresList = [
/* 
  { icon: Upload, title: "Brand Asset Upload", description: "Securely manage your logos, color palettes, and photography libraries in one central hub." },
  { icon: Sparkles, title: "AI Creative Generation", description: "Proprietary models trained specifically for high-conversion betting and sportsbook ad layouts." },
  { icon: Layers, title: "Static Ad Variations", description: "Generate multi-format variations (Square, Vertical, Horizontal) for every placement in seconds." },
  { icon: Layout, title: "Campaign Format Support", description: "Native support for display banners, social media, and affiliate site standard dimensions." },
  { icon: CircleCheck, title: "Creative Review Flow", description: "Collaboration tools for teams to review, annotate, and approve generations before export." },
  { icon: Download, title: "Export & Download", description: "High-resolution, campaign-ready static files ready for immediate media buying deployment." },
  { icon: Users, title: "Team Workspace", description: "Role-based access controls for global creative teams and external agency partners." },
  { icon: ShieldAlert, title: "Brand-Safe Output", description: "Automated guidelines enforcement ensuring every ad stays within your licensed brand limits." }
*/
  { icon: Palette, title: "Brand Kit", description: "Store logos, winning static ads, brand colors, disclaimers, and campaign rules in one centralized brand library." },
  { icon: Sparkles, title: "Creative Generation", description: "Generate campaign-ready static ads using your Brand Kit, selected AI model, aspect ratio, resolution, output format, and creative instructions." },
  { icon: Images, title: "Reference Creatives", description: "Upload your best-performing creatives as references so new generations can follow proven layouts, hooks, and visual directions." },
  { icon: BadgeCheck, title: "Brand Overlay", description: "Apply approved logos, disclaimers, badges, and brand elements to generated creatives to keep every output ready for launch." },
  { icon: Video, title: "Static to Video", description: "Turn approved static creatives into short video ads for paid social, display campaigns, and faster creative testing." },
  { icon: Users, title: "Team Workspaces", description: "Create dedicated team workspaces for brands, campaigns, clients, or agencies with shared assets, review flows, and role-based access." },
  { icon: CloudSync, title: "Google Drive Sync", description: "Import assets directly from Google Drive and export approved creatives back into organized campaign folders." },
  { icon: Workflow, title: "Workflow Automation", description: "Create automated creative generation workflows and share outputs directly with Slack channels and Google Drive destinations." },
];

const solutionsList = [
  /*{
    icon: Trophy, title: "Sportsbook Marketing Teams",
    desc: "React instantly to matchday events. Generate thousands of odds-based ad variations in minutes instead of hours.",
    benefits: ["Matchday Dynamic Creative", "Odds-Integrated Layouts", "Event-Driven Asset Scaling"]
  },*/
  {
    icon: Gamepad2, title: "iGaming Creative Teams",
    desc: "Produce premium slot and casino visuals that maintain brand integrity while driving user engagement across US markets.",
    benefits: ["New Title Launch Kits", "Seasonal Promotion Packs", "Loyalty Reward Visuals"]
  },
  {
    icon: TrendingUp, title: "Affiliate Campaign Managers",
    desc: "Provide your affiliate networks with better, compliant, and consistently on-brand creative materials.",
    benefits: ["Self-Serve Creative Portals", "Standardized Format Export", "Performance Audit Reports"]
  },
  {
    icon: Target, title: "Performance Marketing Teams",
    desc: "Scale your creative testing. Feed your media buying platform with the volume of assets it needs for true optimization.",
    benefits: ["Massive Multivariate Testing", "Format-Dominant Production", "Retargeting Optimized Static Ads"]
  },
  {
    icon: Palette, title: "Design Teams",
    desc: "Eliminate repetitive versioning tasks. Let AI handle the sizes while your designers handle the big ideas.",
    benefits: ["Efficiency Multiplier", "Automated Resizing", "Creative Bottleneck Removal"]
  }
];

const useCasesList = [
  //{ title: "Matchday Momentum", subtitle: "Sportsbook Campaign Scaling", icon: Calendar, tag: "SPORTSBOOK", description: "Scale your creative production to match the real-time velocity of the sports calendar.", points: ["Real-time odds-driven creatives", "Automated player/team asset integration", "Match-specific event branding"] },
  { title: "The Bonus Engine", subtitle: "Promotional Visual Clusters", icon: Gift, tag: "PROMOTIONS", description: "Launch multi-variant bonus announcements in seconds. Test different colorways and CTAs.", points: ["A/B testing creative variations", "Regional bonus localization", "High-impact conversion layouts"] },
  { title: "Omni-Channel Display", subtitle: "Programmatic & Affiliate Nets", icon: Monitor, tag: "DISPLAY ADS", description: "Feed your entire media buying ecosystem with high-performance HTML5-ready static assets.", points: ["Standardized IAB format exports", "Affiliate-specific creative packs", "Retargeting-ready visual sequences"] },
  { title: "Social Performance", subtitle: "Vertical & Story Creators", icon: Share2, tag: "SOCIAL MEDIA", description: "Built for TikTok, Instagram, and more. Generate vertically-optimized creatives that feel native.", points: ["Vertical 9:16 optimized layouts", "Social-first design aesthetics", "Micro-campaign rapid versioning"] },
  { title: "Global Localization", subtitle: "Multi-Market Creative Packs", icon: MapPin, tag: "LOCALIZATION", description: "Enter new markets faster. Translate and adapt your flagship campaign creatives automatically.", points: ["Automated copy translation", "Market-specific athlete assets", "Regional regulatory compliance"] }
];

const plansList = [
  { name: "Individual", price: "$2,000", period: "/month", desc: "For solo creators and strategists focusing on prompt-driven agility.", features: ["Prompt-based generation", "Up to 200 generations/mo", "Personal asset storage", "Single user workspace", "Standard ad formats", "Standard export quality"], cta: "Start Free Trial", featured: false },
  { name: "Professional Team", price: "$6,500", period: "/month", desc: "For active iGaming marketing teams needing consistency and scale.", features: ["Everything in Individual", "Reference-guided generation", "Upload ad examples for styling", "Up to 2,000 generations/mo", "Invite up to 5 members", "Shared team workspace", "Priority ad formatting"], cta: "Create Team", featured: true },
  { name: "Enterprise", price: "Custom", period: "", desc: "For licensed US operators needing full compliance and custom scale.", features: ["Unlimited generations", "Custom model training", "Unlimited seat access", "Multi-workspace management", "Dedicated compliance audit", "SSO & Custom Security", "Full API/Webhook suite"], cta: "Contact Sales", featured: false }
];

//Infinite Marquee

function InfiniteMarquee({ items, speed = 30, reverse = false }) {
  const doubled = [...items, ...items, ...items, ...items];
  return (
    <div className="overflow-hidden mask-[linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <motion.div
        animate={{ x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
        transition={{ duration: speed, ease: 'linear', repeat: Infinity }}
        className="flex items-center gap-12 w-max"
      >
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-2 text-sm font-black tracking-tighter text-white/30 uppercase hover:text-white/60 transition-colors cursor-default">
              <item.logo className="w-4 h-4" />
              {item.name}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// â”€â”€â”€ Section Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SectionTag({ children, color = 'blue' }) {
  const colorMap = {
    blue: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
    purple: 'border-purple-500/30 bg-purple-500/5 text-purple-400',
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, margin: '-60px' }}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] ${colorMap[color]}`}
    >
      <Sparkles className="w-3 h-3" />
      {children}
    </motion.div>
  );
}

// â”€â”€â”€ Stats Counter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const stats = [
  { value: '50+', label: 'Markets Supported', color: 'text-blue-400' },
  { value: '1M+', label: 'Creatives Yearly', color: 'text-purple-400' },
  { value: '99.9%', label: 'Uptime SLA', color: 'text-emerald-400' },
  { value: '<2s', label: 'Avg. Gen Time', color: 'text-amber-400' },
];

// â”€â”€â”€ Home â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function Home() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  return (
    <div className="relative overflow-x-hidden">

      {/* â”€â”€ HERO â”€â”€ */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex flex-col items-center justify-center pt-28 pb-24 px-6 overflow-hidden"
        style={{ background: 'radial-gradient(ellipse 80% 55% at 50% -10%, rgba(37,99,235,0.28) 0%, transparent 65%)' }}
      >
        {/* Hero Background */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>

          {/* Top-center radial spotlight */}
          <div
            className="absolute inset-x-0 top-0 h-175"
            style={{ background: 'radial-gradient(ellipse 75% 60% at 50% -5%, rgba(37,99,235,0.32) 0%, transparent 70%)' }}
          />

          {/* Dot grid */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(rgba(148,163,255,0.13) 1px, transparent 1px)',
              backgroundSize: '30px 30px',
              maskImage: 'radial-gradient(ellipse 85% 75% at 50% 35%, black 40%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 85% 75% at 50% 35%, black 40%, transparent 100%)',
            }}
          />

          {/* Top edge glow line */}
          <div
            className="absolute top-0 inset-x-0 h-px"
            style={{ background: 'linear-gradient(to right, transparent, rgba(99,131,255,0.5) 30%, rgba(147,100,255,0.4) 60%, transparent)' }}
          />

          {/* Main blue orb â€” left */}
          <motion.div
            animate={{ scale: [1, 1.18, 1] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute rounded-full blur-[130px]"
            style={{
              top: '-20%', left: '-10%',
              width: '70%', height: '70%',
              background: 'rgba(37, 99, 235, 0.38)',
            }}
          />

          {/* Violet orb â€” right */}
          <motion.div
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
            className="absolute rounded-full blur-[150px]"
            style={{
              top: '0%', right: '-15%',
              width: '55%', height: '60%',
              background: 'rgba(109, 40, 217, 0.28)',
            }}
          />

          {/* Accent indigo â€” bottom center */}
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
            className="absolute rounded-full blur-[120px]"
            style={{
              bottom: '0%', left: '15%',
              width: '60%', height: '45%',
              background: 'rgba(79, 70, 229, 0.22)',
            }}
          />

          {/* Floating particles */}
          {[
            { left: '10%', top: '20%', dur: 5.2, delay: 0 },
            { left: '25%', top: '58%', dur: 7.0, delay: 1.2 },
            { left: '44%', top: '25%', dur: 6.1, delay: 0.6 },
            { left: '60%', top: '68%', dur: 8.0, delay: 2.0 },
            { left: '72%', top: '18%', dur: 5.8, delay: 1.5 },
            { left: '85%', top: '45%', dur: 6.6, delay: 0.3 },
            { left: '18%', top: '82%', dur: 7.4, delay: 3.0 },
            { left: '90%', top: '70%', dur: 5.5, delay: 1.8 },
            { left: '50%', top: '40%', dur: 6.8, delay: 2.5 },
            { left: '35%', top: '78%', dur: 7.2, delay: 0.9 },
          ].map((p, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                left: p.left, top: p.top,
                width: i % 3 === 0 ? 3 : 2,
                height: i % 3 === 0 ? 3 : 2,
                background: i % 2 === 0 ? 'rgba(99,131,255,0.55)' : 'rgba(167,139,250,0.45)',
              }}
              animate={{ y: [0, -22, 0], opacity: [0.2, 0.7, 0.2] }}
              transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
            />
          ))}

          {/* Bottom fade */}
          <div
            className="absolute bottom-0 left-0 right-0 h-64"
            style={{ background: 'linear-gradient(to top, #05070d 0%, #05070d88 40%, transparent 100%)' }}
          />
        </div>

        <motion.div
          style={{ y: heroY, opacity: heroOpacity, scale: heroScale }}
          className="max-w-7xl mx-auto w-full"
        >
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">

          {/* Left: text */}
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/30 bg-blue-500/5 text-blue-400 text-[10px] font-black tracking-[0.2em] uppercase mb-10"
          >
            <Sparkles className="w-3 h-3" />
            Creative Engine for iGaming
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter mb-8 leading-none"
          >
            <span className="bg-clip-text text-transparent bg-linear-to-b from-white via-gray-100 to-gray-500 block pr-2">
              AI Ad Creatives
            </span>
            <span className="bg-clip-text text-transparent bg-linear-to-r from-blue-500 via-blue-400 to-purple-700 block pb-2">
              for iGaming.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="max-w-2xl mx-auto text-lg md:text-xl text-gray-400 mb-12 leading-relaxed"
          >
            The production-grade platform for iGaming brands. Switch between Personal and Team workspaces. Generate at velocity. Ship compliant.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4"
          >
            <Link
              to="/signup"
              className="group w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:shadow-[0_0_50px_rgba(37,99,235,0.6)] flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Start Generating Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button
              onClick={() => document.getElementById('product')?.scrollIntoView({ behavior: 'smooth' })}
              className="group w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-full font-bold transition-all flex items-center justify-center gap-2"
            >
              See How It Works
              <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform animate-bounce" />
            </button>
          </motion.div>
          </div>{/* /left col */}

          {/* Right: skeletal dashboard preview */}
          <motion.div
            initial={{ opacity: 0, x: 40, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 0.5, duration: 0.9, type: 'spring', stiffness: 70, damping: 20 }}
            className="w-full lg:w-150 lg:flex-none relative"
          >
            <div className="absolute inset-x-[10%] -bottom-6 h-20 bg-blue-600/15 blur-3xl rounded-full pointer-events-none" />

            {/* Floating badge: top-left â€” Avg Gen Time */}
            <motion.div
              initial={{ opacity: 0, x: -14, y: 8 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ delay: 1.5, type: 'spring', stiffness: 120, damping: 18 }}
              className="absolute -left-10 top-20 z-20 pointer-events-none hidden sm:block"
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
                className="bg-[#0b0e1a]/95 backdrop-blur-md border border-white/10 rounded-2xl px-3.5 py-2.5 shadow-2xl"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Avg Gen Time</div>
                    <div className="text-sm font-black text-white">&lt; 2s</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Floating badge: right â€” Compliance Rate */}
            <motion.div
              initial={{ opacity: 0, x: 14, y: 8 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ delay: 1.8, type: 'spring', stiffness: 120, damping: 18 }}
              className="absolute -right-10 top-2/3 z-20 pointer-events-none hidden sm:block"
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 1.4 }}
                className="bg-[#0b0e1a]/95 backdrop-blur-md border border-white/10 rounded-2xl px-3.5 py-2.5 shadow-2xl"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Compliance Rate</div>
                    <div className="text-sm font-black text-white">99.8%</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Floating badge: bottom â€” Markets */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.0, type: 'spring', stiffness: 120, damping: 18 }}
              className="absolute left-6 -bottom-6 z-20 pointer-events-none hidden sm:block"
            >
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut', delay: 2.8 }}
                className="bg-[#0b0e1a]/95 backdrop-blur-md border border-white/10 rounded-2xl px-3.5 py-2.5 shadow-2xl"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                    <Globe className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div>
                    <div className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Markets Supported</div>
                    <div className="text-sm font-black text-white">50+ Global</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
            >
            <div className="relative rounded-2xl border border-white/8 bg-[#0a0d14] shadow-[0_24px_80px_rgba(0,0,0,0.55)] overflow-hidden">

              {/* Chrome */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-black/50">
                <div className="flex items-center gap-2">
                  {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-white/10" />)}
                  <div className="hidden sm:block h-3.5 w-32 bg-white/5 rounded-md ml-1" />
                </div>
                <div className="flex items-center gap-1.5">
                  <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2.2, repeat: Infinity }} className="w-1 h-1 rounded-full bg-emerald-500/50" />
                  <div className="h-2 w-5 bg-white/8 rounded" />
                </div>
              </div>

              {/* Dashboard body */}
              <div className="flex" style={{ height: 340 }}>

                {/* Sidebar skeleton */}
                <div className="hidden sm:flex w-32 shrink-0 border-r border-white/5 bg-[#07090f] flex-col py-3 px-2 gap-2">
                  <div className="flex items-center gap-2 px-2 py-1 mb-1">
                    <div className="w-5 h-5 rounded-md bg-blue-600/25 shrink-0" />
                    <div className="h-2 w-12 bg-white/10 rounded" />
                  </div>
                  {[[false,false],[true,false,false],[false,false]].map((group,gi) => (
                    <div key={gi} className="space-y-0.5">
                      <div className="h-1 w-8 bg-white/5 rounded mx-2 mb-1" />
                      {group.map((active,ii) => (
                        <div key={ii} className={`relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${active ? 'bg-blue-500/8' : ''}`}>
                          {active && <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }} className="absolute inset-0 border border-blue-500/20 rounded-lg" />}
                          <div className={`w-2.5 h-2.5 rounded shrink-0 ${active ? 'bg-blue-400/25' : 'bg-white/8'}`} />
                          <div className={`h-1.5 rounded flex-1 ${active ? 'bg-white/15' : 'bg-white/6'}`} />
                          {active && <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} className="w-1 h-1 rounded-full bg-blue-400/60 shrink-0" />}
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="mt-auto p-2 bg-blue-500/5 border border-blue-500/8 rounded-xl space-y-1.5">
                    <div className="flex justify-between">
                      <div className="h-1.5 w-7 bg-blue-400/20 rounded" />
                      <div className="h-1.5 w-5 bg-white/8 rounded" />
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-0.5 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: '45%' }} transition={{ duration: 1.8, ease: 'easeOut', delay: 0.8 }} className="h-full bg-linear-to-r from-blue-600/50 to-blue-400/30 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Main skeleton */}
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="space-y-1.5">
                      <div className="h-2.5 w-14 bg-white/12 rounded" />
                      <div className="h-1.5 w-24 bg-white/5 rounded" />
                    </div>
                    <div className="h-6 w-18 bg-blue-500/12 border border-blue-500/12 rounded-lg" />
                  </div>
                  <div className="flex-1 p-3 space-y-2.5 overflow-hidden">
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { cls: 'bg-blue-500/8 border-blue-500/8', d: 0, label: 'Creatives', val: '1,240', trend: '+12%', vc: 'text-blue-300' },
                        { cls: 'bg-purple-500/5 border-purple-500/8', d: 1.5, label: 'Generated', val: '98', trend: 'today', vc: 'text-purple-300' },
                        { cls: 'bg-amber-500/5 border-amber-500/8', d: 3, label: 'Avg Time', val: '1.8s', trend: 'â†“ fast', vc: 'text-amber-300' },
                        { cls: 'bg-emerald-500/5 border-emerald-500/8', d: 4.5, label: 'Approved', val: '100%', trend: 'passed', vc: 'text-emerald-300' },
                      ].map(({ cls, d, label, val, trend, vc }, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.68 + i * 0.06 }} className={`border rounded-xl p-2.5 space-y-0.5 relative overflow-hidden ${cls}`}>
                          <div className="text-[7px] font-bold text-white/25 uppercase tracking-wide truncate">{label}</div>
                          <motion.div animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity, delay: d }} className={`text-[11px] font-black leading-none ${vc}`}>{val}</motion.div>
                          <div className="text-[7px] text-white/20">{trend}</div>
                          <motion.div
                            animate={{ x: ['-100%', '200%'] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: d + 0.5 }}
                            className="absolute inset-y-0 w-1/2 bg-linear-to-r from-transparent via-white/4 to-transparent skew-x-12"
                          />
                        </motion.div>
                      ))}
                    </div>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="p-2.5 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-center gap-2.5">
                      <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.8, repeat: Infinity }} className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/12 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-1.5 w-28 bg-white/10 rounded" />
                        <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                          <motion.div animate={{ width: ['0%', '72%', '72%', '0%'] }} transition={{ duration: 4.5, times: [0, 0.45, 0.8, 1], ease: 'easeInOut', repeat: Infinity, delay: 1.0 }} className="h-full bg-linear-to-r from-blue-500/50 to-blue-300/30 rounded-full" />
                        </div>
                      </div>
                      <div className="h-1.5 w-5 bg-white/8 rounded shrink-0" />
                    </motion.div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { b:'border-emerald-500/8', p:false, pop:false },
                        { b:'border-blue-500/10',   p:true,  pop:false },
                        { b:'border-purple-500/8',  p:false, pop:true  },
                      ].map((c,i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 1.08 + i * 0.1, duration: 0.4, ease: 'easeOut' }}
                          className={`rounded-xl border ${c.b} bg-white/3 p-1.5 flex flex-col gap-1.5`}
                        >
                          <div className="aspect-square rounded-lg bg-white/5 relative overflow-hidden">
                            {c.p && <motion.div className="absolute inset-0 bg-linear-to-tr from-blue-500/12 to-transparent" animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />}
                            {c.pop && <motion.div className="absolute inset-0 bg-linear-to-tr from-purple-500/10 to-transparent" animate={{ opacity: [0.2, 0.6, 0.2] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }} />}
                          </div>
                          <div className="h-1.5 w-3/4 bg-white/8 rounded" />
                          <div className="h-1 w-1/2 bg-white/5 rounded" />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status bar */}
              <div className="px-4 py-2 border-t border-white/5 bg-black/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 1.8, repeat: Infinity }} className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-blue-400/40" />
                    <div className="h-1.5 w-14 bg-blue-400/12 rounded" />
                  </motion.div>
                  <div className="h-1.5 w-10 bg-white/5 rounded hidden sm:block" />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-emerald-500/35" />
                  <div className="h-1.5 w-18 bg-white/5 rounded" />
                </div>
              </div>
            </div>
            </motion.div>
          </motion.div>
          </div>{/* /flex row */}
        </motion.div>
      </section>

      {/* â”€â”€ MARQUEE / TRUSTED BRANDS â”€â”€ */}
      <section className="py-16 border-y border-white/5 bg-black overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 mb-10">
          <p className="text-center text-gray-600 text-[10px] font-black uppercase tracking-[0.3em]">
            Trusted Creative Engine for Global Ad Platforms
          </p>
        </div>
        <div className="space-y-5">
          <InfiniteMarquee items={brandsWLogos} speed={35} />
          <InfiniteMarquee items={[...brandsWLogos].reverse()} speed={28} reverse />
        </div>
      </section>

      {/* â”€â”€ HOW IT WORKS â”€â”€ */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24 space-y-5">
            <SectionTag>Workflow</SectionTag>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, margin: '-60px' }}
              className="text-4xl md:text-5xl font-black tracking-tight"
            >
              Built for Creative Velocity
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: false, margin: '-60px' }}
              transition={{ delay: 0.1 }}
              className="text-gray-500 max-w-xl mx-auto"
            >
              Our streamlined workflow takes you from raw assets to high-end ad creatives in record time.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-16 left-[16.7%] right-[16.7%] h-px bg-linear-to-r from-transparent via-blue-500/30 to-transparent" />

            {[
              { icon: Upload, title: "Build Your Brand Kit", desc: "Import logos, winning statics, disclaimers, campaign assets, and brand rules from Google Drive or direct upload.", step: "01" },
              { icon: Sparkles, title: "Generate & Enhance Creatives", desc: "Create static ad variations with AI, apply logos and disclaimers, and turn approved statics into video creatives.", step: "02" },
              { icon: Download, title: "Automate Delivery", desc: "Review with your team, export to Google Drive, and send generated creatives directly to Slack channels.", step: "03" }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: '-60px' }}
                transition={{ delay: idx * 0.12, type: 'spring', stiffness: 120, damping: 20 }}
                whileHover={{ y: -4 }}
                className="relative p-8 rounded-3xl bg-[#0a0d14] border border-white/5 hover:border-blue-500/30 transition-colors group"
              >
                <div className="absolute top-5 right-6 font-mono text-6xl font-black text-white/3 group-hover:text-blue-500/8 transition-colors select-none">
                  {item.step}
                </div>
                <div className="relative z-10">
                  <motion.div
                    whileHover={{ rotate: [0, -5, 5, 0] }}
                    transition={{ duration: 0.4 }}
                    className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mb-8 group-hover:bg-blue-600 group-hover:border-blue-600 transition-all text-blue-400 group-hover:text-white"
                  >
                    <item.icon className="w-6 h-6" />
                  </motion.div>
                  <h3 className="text-xl font-black mb-4">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed text-sm">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* â”€â”€ STATS BAND â”€â”€ */}
      <div className="py-16 px-6 bg-[#080a10] border-y border-white/5">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, margin: '-60px' }}
              transition={{ delay: i * 0.08 }}
              className="text-center"
            >
              <div className={`text-4xl md:text-5xl font-black mb-2 ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* â”€â”€ PRODUCT â”€â”€ */}
      <section id="product" className="scroll-mt-24 pt-32 pb-20">
        <div className="max-w-4xl mx-auto text-center px-6 mb-24 space-y-5">
          <SectionTag>Core Platform</SectionTag>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: '-60px' }}
            className="text-4xl md:text-6xl font-black tracking-tighter"
          >
            The Operating System<br className="hidden md:block" /> for iGaming Creatives
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false, margin: '-60px' }}
            className="text-lg text-gray-400"
          >
            Deep flexibility with dedicated Personal and Team workspaces.
          </motion.p>
        </div>

        {/* Feature Grid */}
        <div className="px-6 py-20 bg-[#080a10]">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuresList.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: '-60px' }}
                transition={{ delay: idx * 0.06, type: 'spring', stiffness: 120, damping: 20 }}
                whileHover={{ y: -4, borderColor: 'rgba(59,130,246,0.3)' }}
                className="p-7 rounded-2xl bg-black border border-white/5 group cursor-default transition-colors"
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:border-blue-600 transition-all text-blue-400 group-hover:text-white"
                >
                  <feature.icon className="w-5 h-5" />
                </motion.div>
                <h3 className="text-base font-black mb-3">{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Workspace Comparison */}
        <div className="py-32 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                icon: Zap, title: "Personal Workspaces", color: 'text-gray-300', iconBg: 'bg-zinc-800',
                desc: "For independent creators and rapid prototyping. Use our AI agent to generate stunning static ads through intuitive natural language prompts.",
                items: [{ icon: CircleCheck, text: "Prompt-to-Creative Engine", c: "text-gray-500" }, { icon: CircleCheck, text: "Individual Export Vault", c: "text-gray-500" }, { icon: CircleCheck, text: "Easy Team Upgrade Path", c: "text-gray-500" }],
                gradient: 'from-zinc-950 to-black', border: 'border-white/5'
              },
              {
                icon: Users, title: "Team Workspaces", color: 'text-white', iconBg: 'bg-blue-600',
                desc: "Invite colleagues and scale production. Teams can upload static ad examples to guide the AI, ensuring every generation mirrors your high-performers.",
                items: [{ icon: CircleCheck, text: "Reference-based Style Tuning", c: "text-blue-400" }, { icon: CircleCheck, text: "Member Invitations & Roles", c: "text-blue-400" }, { icon: CircleCheck, text: "Shared Asset Libraries", c: "text-blue-400" }],
                gradient: 'from-blue-900/15 to-black', border: 'border-blue-500/20'
              }
            ].map((ws, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: '-60px' }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 100, damping: 20 }}
                whileHover={{ y: -4 }}
                className={`p-12 rounded-[2.5rem] bg-linear-to-br ${ws.gradient} border ${ws.border} transition-all`}
              >
                <div className={`w-12 h-12 ${ws.iconBg} rounded-2xl flex items-center justify-center mb-8`}>
                  <ws.icon className="text-white w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black mb-5">{ws.title}</h3>
                <p className="text-gray-400 mb-8 leading-relaxed">{ws.desc}</p>
                <ul className="space-y-3">
                  {ws.items.map((item, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm font-semibold">
                      <item.icon className={`w-4 h-4 ${item.c}`} />
                      <span className="text-gray-300">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Product Stages */}
        <div className="py-20 px-6">
          <div className="max-w-7xl mx-auto space-y-40">
            {[
              { color: 'text-blue-500', stage: 'STAGE 01 // BRAND KIT & ASSET INGESTION', title: 'Centralize Your Creative System', desc: 'Connect Google Drive or upload directly to build a complete Brand Kit with logos, top-performing statics, disclaimers, campaign assets, and brand rules.', items: ['Brand Kit Management', 'Google Drive Import', 'Logos, Disclaimers & Winning Statics'], visual: 'blue', iconColor: 'text-blue-500' },
              { color: 'text-purple-500', stage: 'STAGE 02 // AI CREATIVE GENERATION', title: 'Generate Creatives Built to Scale', desc: 'Create campaign-ready static ads using your Brand Kit, reference creatives, selected AI model, aspect ratio, format, and custom generation settings.', items: ['Brand-Guided Creative Generation', 'Multi-Format Static Variations', 'Logo & Disclaimer Overlay'], visual: 'purple', iconColor: 'text-purple-500', flip: true },
              { color: 'text-emerald-500', stage: 'STAGE 03 // WORKSPACE, VIDEO & AUTOMATION', title: 'Review. Automate. Deliver.', desc: 'Collaborate in team workspaces, turn approved statics into videos, and automate creative delivery to Slack channels or Google Drive folders.', items: ['Team Workspace Review','Static-to-Video Creation','Slack & Google Drive Automation'], cta: true, visual: 'emerald', iconColor: 'text-emerald-500' }
            ].map((stage, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: '-80px' }}
                transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ${stage.flip ? 'lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1' : ''}`}
              >
                <div className="space-y-6">
                  <div className={`font-mono text-xs uppercase tracking-widest ${stage.color}`}>{stage.stage}</div>
                  <h2 className="text-3xl md:text-5xl font-black leading-tight">{stage.title}</h2>
                  <p className="text-gray-400 text-lg leading-relaxed">{stage.desc}</p>
                  {stage.items.length > 0 && (
                    <ul className="space-y-3">
                      {stage.items.map((item, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: false, margin: '-60px' }}
                          transition={{ delay: i * 0.08 }}
                          className="flex items-center gap-3 text-gray-300"
                        >
                          <CircleCheck className={`w-5 h-5 ${stage.iconColor}`} />
                          <span>{item}</span>
                        </motion.li>
                      ))}
                    </ul>
                  )}
                  {stage.cta && (
                    <Link to="/signup" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full font-bold hover:bg-emerald-500 hover:text-white transition-all group">
                      Try the Workflow
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  )}
                </div>
                <div className={`aspect-video rounded-3xl border border-white/8 relative overflow-hidden bg-linear-to-br ${stage.visual === 'blue' ? 'from-blue-900/20' : stage.visual === 'purple' ? 'from-purple-900/20' : 'from-emerald-900/20'} to-zinc-900 flex items-center justify-center p-12`}>
                  {stage.visual === 'blue' && (
                    <div className="grid grid-cols-3 gap-3 w-full">
                      {[1,2,3,4,5,6].map(i => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.8 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: false, margin: '-60px' }}
                          transition={{ delay: i * 0.05 }}
                          className="aspect-square bg-white/5 border border-white/10 rounded-xl"
                        />
                      ))}
                    </div>
                  )}
                  {stage.visual === 'purple' && (
                    <div className="w-full space-y-4">
                      {[1, 0.67, 0.45].map((w, i) => (
                        <div key={i} className="h-3 bg-purple-600/10 rounded-full overflow-hidden">
                          <motion.div
                            animate={{ x: ['-100%', '200%'] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', delay: i * 0.4 }}
                            className="h-full w-1/3 bg-linear-to-r from-purple-500/0 via-purple-500 to-purple-500/0"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {stage.visual === 'emerald' && (
                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      className="p-8 bg-black/70 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-5"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <Download className="w-7 h-7 text-emerald-400" />
                      </div>
                      <div>
                        <div className="font-black text-white">Campaign_Export.zip</div>
                        <div className="text-xs text-gray-500 mt-1">248 MB· All Formats Included</div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* â”€â”€ SOLUTIONS â”€â”€ */}
      <section id="solutions" className="scroll-mt-24 pt-32 pb-20 border-t border-white/5 bg-[#080a10]">
        <div className="max-w-4xl mx-auto text-center px-6 mb-24 space-y-5">
          <SectionTag>Solutions</SectionTag>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: '-60px' }}
            className="text-4xl md:text-6xl font-black tracking-tighter"
          >
            Tailored for Every<br className="hidden md:block" /> Marketing Division
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false, margin: '-60px' }}
            className="text-lg text-gray-500"
          >
            Troxa.ai adapts to your organizational goals, whether focused on performance scaling or brand stewardship.
          </motion.p>
        </div>

        <div className="px-6 pb-20">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
            {solutionsList.map((sol, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: '-60px' }}
                transition={{ delay: idx * 0.08 }}
                whileHover={{ y: -3 }}
                className={`p-8 md:p-10 rounded-3xl border border-white/8 bg-linear-to-br ${idx === 0 ? 'from-blue-900/15 to-black lg:col-span-2' : 'from-zinc-950 to-black'} hover:border-blue-500/25 transition-all group`}
              >
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1">
                    <motion.div
                      whileHover={{ rotate: [0, -8, 8, 0] }}
                      transition={{ duration: 0.4 }}
                      className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-7 text-blue-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all"
                    >
                      <sol.icon className="w-6 h-6" />
                    </motion.div>
                    <h3 className="text-xl md:text-2xl font-black mb-3">{sol.title}</h3>
                    <p className="text-gray-400 mb-7 max-w-md leading-relaxed">{sol.desc}</p>
                    <Link to="/signup" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 group-hover:text-blue-400 transition-colors">
                      Learn More <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                  <div className="flex-1 bg-black/40 rounded-2xl p-6 border border-white/5">
                    <h4 className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] mb-5 border-b border-white/5 pb-3">Primary Advantages</h4>
                    <ul className="space-y-4">
                      {sol.benefits.map((b, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: false, margin: '-60px' }}
                          transition={{ delay: i * 0.07 }}
                          className="flex items-center gap-3 text-sm text-gray-300 font-semibold"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                          {b}
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Global scale 
        <div className="py-24 px-6 bg-[#080a10] border-y border-white/5">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-20">
            <div className="max-w-xl space-y-8">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: '-60px' }}
                className="text-4xl font-black italic"
              >
                Engineered for Global Scale.
              </motion.h2>
              <p className="text-gray-400 leading-relaxed">From localized matchday campaigns in South America to seasonal sportsbook pushes in Europe, Troxa.ai supports multi-market creative workflows.</p>
              <div className="grid grid-cols-2 gap-8">
                {[
                  { value: '50+', label: 'Markets Supported', color: 'decoration-blue-600' },
                  { value: '1M+', label: 'Creatives Yearly', color: 'decoration-purple-600' }
                ].map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: false, margin: '-60px' }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <div className={`text-4xl font-black text-white mb-2 underline ${s.color} decoration-4 underline-offset-8`}>{s.value}</div>
                    <div className="text-gray-600 text-xs uppercase tracking-widest">{s.label}</div>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="relative shrink-0">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                className="w-64 h-64 md:w-80 md:h-80 border border-white/5 rounded-full flex items-center justify-center"
              >
                <div className="w-48 h-48 md:w-60 md:h-60 border border-blue-500/15 rounded-full flex items-center justify-center">
                  <Globe className="w-16 h-16 text-blue-500 opacity-20" />
                </div>
              </motion.div>
              {[
                { pos: 'top-4 left-0', color: 'bg-green-500', text: 'Live: UK Market' },
                { pos: 'bottom-8 right-0', color: 'bg-blue-500', text: 'Active: Brazil Pack' }
              ].map((badge, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: false, margin: '-60px' }}
                  transition={{ delay: 0.3 + i * 0.15 }}
                  className={`absolute ${badge.pos} p-3 bg-black border border-white/10 rounded-xl shadow-2xl`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 ${badge.color} rounded-full animate-pulse`} />
                    <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider">{badge.text}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>*/}
      </section>

      {/* â”€â”€ USE CASES â”€â”€ */}
      {/*<section id="use-cases" className="scroll-mt-24 pt-32 pb-20 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center px-6 mb-24 space-y-5">
          <SectionTag color="purple">Use Cases</SectionTag>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: '-60px' }}
            className="text-4xl md:text-6xl font-black tracking-tighter italic"
          >
            Creative Impact,<br className="hidden md:block" /> At Infinite Scale
          </motion.h2>
        </div>

        <div className="px-6">
          <div className="max-w-7xl mx-auto space-y-40">
            {useCasesList.map((uc, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: '-80px' }}
                transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                className={`flex flex-col ${idx % 2 !== 0 ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-16 lg:gap-24 items-center`}
              >
                <div className="flex-1 space-y-7">
                  <div>
                    <span className="text-blue-500 font-mono text-[10px] font-black tracking-[0.3em] uppercase block mb-3">{uc.tag}</span>
                    <h3 className="text-3xl md:text-4xl font-black mb-2">{uc.title}</h3>
                    <p className="text-lg text-gray-500 font-medium italic">{uc.subtitle}</p>
                  </div>
                  <p className="text-gray-400 text-lg leading-relaxed">{uc.description}</p>
                  <ul className="space-y-3">
                    {uc.points.map((p, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: false, margin: '-60px' }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-center gap-3 text-sm font-semibold text-gray-300"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                        {p}
                      </motion.li>
                    ))}
                  </ul>
                  <Link to="/signup" className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all group text-sm font-bold">
                    View Detailed Specs
                    <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </Link>
                </div>
                <div className="flex-1 w-full">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="aspect-4/3 bg-linear-to-br from-zinc-900 to-black border border-white/5 rounded-4xl relative overflow-hidden group shadow-2xl"
                  >
                    <div className="absolute inset-0 bg-blue-600/3 group-hover:bg-blue-600/8 transition-colors duration-700" />
                    <div className="w-full h-full flex items-center justify-center p-12 relative">
                      <motion.div
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <uc.icon className="w-28 h-28 text-white/4 group-hover:text-blue-500/10 transition-all duration-700" />
                      </motion.div>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4/5 h-2/3 rounded-2xl border border-white/5 border-dashed" />
                      <div className="absolute top-6 right-6 px-3 py-1.5 bg-black/80 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-blue-400">
                        {uc.tag}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>*/}

      {/* â”€â”€ PRICING â”€â”€ */}
      {/*<section id="pricing" className="scroll-mt-24 pt-32 pb-20 border-t border-white/5 bg-black">
        <div className="max-w-4xl mx-auto text-center px-6 mb-24 space-y-5">
          <SectionTag>Pricing</SectionTag>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: '-60px' }}
            className="text-4xl md:text-6xl font-black tracking-tight"
          >
            Predictable Pricing<br className="hidden md:block" /> for Professional Teams
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false, margin: '-60px' }}
            className="text-gray-500 text-lg"
          >
            Scale your creative output without scaling your overhead.
          </motion.p>
        </div>

        <div className="px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {plansList.map((plan, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, margin: '-60px' }}
                  transition={{ delay: idx * 0.1, type: 'spring', stiffness: 120, damping: 20 }}
                  whileHover={{ y: -6 }}
                  className={`relative p-8 md:p-10 rounded-[2.5rem] border transition-all ${
                    plan.featured
                      ? 'bg-linear-to-br from-blue-900/25 to-black border-blue-500/40 shadow-[0_0_50px_rgba(37,99,235,0.15)] md:scale-[1.04] z-10'
                      : 'bg-[#0a0d14] border-white/5 hover:border-white/10'
                  }`}
                >
                  {plan.featured && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: false, margin: '-60px' }}
                      className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-black px-5 py-1.5 rounded-full uppercase tracking-widest shadow-xl flex items-center gap-1.5"
                    >
                      <Star className="w-3 h-3" /> Most Popular
                    </motion.div>
                  )}

                  <div className="mb-8">
                    <h3 className="text-lg font-black mb-2">{plan.name}</h3>
                    <p className="text-gray-500 text-sm mb-8 min-h-10">{plan.desc}</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-linear-to-b from-white to-gray-400">{plan.price}</span>
                      {plan.period && <span className="text-gray-500 font-medium">{plan.period}</span>}
                    </div>
                  </div>

                  <div className="space-y-3 mb-8 border-t border-white/5 pt-7">
                    {plan.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`p-1 rounded-full shrink-0 ${plan.featured ? 'bg-blue-600/20 text-blue-400' : 'bg-white/5 text-gray-600'}`}>
                          <Check className="w-3 h-3" />
                        </div>
                        <span className="text-sm text-gray-400">{f}</span>
                      </div>
                    ))}
                  </div>

                  <Link
                    to="/signup"
                    className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
                      plan.featured
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40'
                        : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white'
                    }`}
                  >
                    {plan.cta}
                    {plan.featured && <ArrowRight className="w-4 h-4" />}
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        
        <div className="py-28 px-6 mt-20">
          <div className="max-w-7xl mx-auto rounded-[2.5rem] bg-[#080a10] border border-white/5 p-12 lg:p-20">
            <div className="text-center mb-16">
              <h3 className="text-2xl font-black mb-3 italic">Platform Standard Excellence</h3>
              <p className="text-gray-500 text-sm">Every plan includes our core B2B infrastructure.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              {[
                { icon: ShieldCheck, title: "Compliance First", desc: "Automated filters for 18+ and regional gaming requirements." },
                { icon: Zap, title: "Ultra-Fast Engine", desc: "Cloud-native infrastructure optimized for high-volume tasks." },
                { icon: Users, title: "Collaborative", desc: "Shared workspaces and asset versioning for creative teams." },
                { icon: Globe, title: "Localized", desc: "Support for global iGaming market and currency visuals." }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, margin: '-60px' }}
                  transition={{ delay: i * 0.08 }}
                  className="space-y-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-blue-500" />
                  </div>
                  <h4 className="font-black">{item.title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        
        <div className="px-6">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, margin: '-60px' }}
              className="flex flex-col md:flex-row items-center justify-between p-8 md:p-10 rounded-3xl bg-blue-600/5 border border-blue-500/15 gap-8"
            >
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-7 h-7 text-blue-500" />
                </div>
                <div>
                  <h4 className="text-xl font-black mb-1">Need a custom enterprise solution?</h4>
                  <p className="text-sm text-gray-500">Custom deployment and model training for large operators.</p>
                </div>
              </div>
              <Link to="/signup" className="px-8 py-4 bg-white text-black rounded-full font-black hover:bg-blue-500 hover:text-white transition-all shadow-lg whitespace-nowrap">
                Contact Sales
              </Link>
            </motion.div>
          </div>
        </div>
      </section>*/}

      {/* â”€â”€ ABOUT â”€â”€ */}
      <section id="about" className="scroll-mt-24 pt-32 pb-20 border-t border-white/5 bg-black">
        <div className="max-w-4xl mx-auto text-center px-6 mb-32 space-y-6">
          <SectionTag color="emerald">About</SectionTag>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: '-60px' }}
            className="text-4xl md:text-6xl font-black tracking-tighter"
          >
            The Future of Creative Production
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false, margin: '-60px' }}
            className="text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed border-l-2 border-blue-600 pl-8 text-left mt-10"
          >
            Troxa.ai is a product of RMGS, an iGaming marketing company focused on user acquisition, performance creatives, and marketing automation.
            <p className="pt-4">Built from real campaign experience, Troxa.ai helps marketing teams centralize brand assets, generate campaign-ready creatives, automate production workflows, and deliver approved outputs across Slack and Google Drive.</p>
          </motion.p>
        </div>

        {/* <div className="px-6 py-24 bg-[#080a10] border-y border-white/5">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-8">
              <h3 className="text-3xl md:text-4xl font-black">Our Mission</h3>
              <p className="text-gray-400 text-lg leading-relaxed">
                At RMGS, our mission is to make high-end creative production faster, more structured, and more accessible for growth-focused marketing teams.
                <p className="pt-4">With Troxa.ai, we automate the repetitive parts of creative production — asset preparation, format variation, brand overlay, review, export, and delivery — so teams can focus on strategy, testing, and performance.</p>
              </p>
              <div className="space-y-4">
                {[
                  { icon: ShieldCheck, title: "Compliance-First DNA", desc: "Every line of code written with regulatory awareness as priority." },
                  { icon: Heart, title: "Responsible Innovation", desc: "We build tools that respect the industry's commitment to player protection." },
                  { icon: Zap, title: "Performance Excellence", desc: "Our AI is refined on data and aesthetics that drive measurable growth." }
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: false, margin: '-60px' }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4 p-5 rounded-2xl bg-black border border-white/5 hover:border-blue-500/15 transition-colors"
                  >
                    <item.icon className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <h5 className="font-black text-white mb-1">{item.title}</h5>
                      <p className="text-gray-500 text-sm">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false, margin: '-60px' }}
              className="grid grid-cols-2 gap-4"
            >
              {[
                { label: 'Founded', value: '2026', sub: 'US-first focus' },
                { label: 'Team', value: '28+', sub: 'Across North America' },
                { label: 'Operators Served', value: '40+', sub: 'Licensed US brands' },
                { label: 'Compliance Rate', value: '99.8%', sub: 'Creative pass-through' },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, margin: '-60px' }}
                  transition={{ delay: i * 0.08 }}
                  className="p-6 bg-black border border-white/5 rounded-2xl hover:border-blue-500/15 transition-colors"
                >
                  <div className="text-3xl font-black text-white mb-1">{s.value}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-blue-400">{s.label}</div>
                  <div className="text-[10px] text-gray-600 mt-1">{s.sub}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div> */}

        <div className="py-20 px-6">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: "Why we exist?", body: "The iGaming market never stops. Odds change, seasons shift, and promotions rotate daily. Traditional creative teams simply cannot keep up with the volume needed to dominate programmatic and social channels. We fill that void." },
              { title: "Our approach?", body: "We don't replace humans, we give them a 100x multiplier. Troxa.ai functions as a specialized team member that understands brand guidelines, ad dimensions, and iGaming aesthetics perfectly." }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: '-60px' }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -3 }}
                className="p-8 rounded-3xl bg-[#080a10] border border-white/5 hover:border-white/10 transition-all"
              >
                <h4 className="text-lg font-black mb-4">{item.title}</h4>
                <p className="text-gray-400 leading-relaxed italic">{item.body}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Compliance disclaimer */}
        <div className="py-12 px-6">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-[0.2em]">
              US B2B Infrastructure Status
            </div>
            <p className="text-gray-600 text-xs leading-relaxed">
              Troxa.ai provides AI creative generation tools only. We do not operate gambling services. We are a technology provider serving licensed US iGaming operators and their marketing agencies. Every creative must be vetted by your compliance team before live deployment.
            </p>
          </div>
        </div>
      </section>

      {/* â”€â”€ COMPLIANCE BAND â”€â”€ */}
      <div className="bg-blue-600/5 border-y border-blue-500/10 py-5">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-center gap-4">
          <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
          <p className="text-[10px] text-blue-400/70 font-bold tracking-[0.2em] uppercase">
            Strictly B2B Infrastructure· Not a Gambling Operator· Compliance Verified Platform
          </p>
        </div>
      </div>

      {/* â”€â”€ FINAL CTA â”€â”€ */}
      <section className="py-32 px-6 bg-black">
        <div className="max-w-5xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: '-60px' }}
            className="text-center px-8 py-24 rounded-[3rem] bg-linear-to-br from-blue-900/20 via-[#0a0d14] to-purple-900/10 border border-white/8 relative overflow-hidden"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-px bg-linear-to-r from-transparent via-blue-500/50 to-transparent" />
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px]" />

            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 mx-auto mb-8 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center"
            >
              <Sparkles className="w-7 h-7 text-blue-400" />
            </motion.div>

            <h2 className="text-4xl md:text-6xl font-black mb-8 leading-tight">
              Ready to Scale Your<br className="hidden md:block" /> Creative Production?
            </h2>
            <p className="text-gray-400 text-lg mb-12 max-w-xl mx-auto leading-relaxed">
              Join leading US iGaming brands using Troxa.ai to multiply their ad variation output without increasing design overhead.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/signup"
                className="group w-full sm:w-auto px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-black text-lg transition-all shadow-[0_0_40px_rgba(37,99,235,0.4)] hover:shadow-[0_0_60px_rgba(37,99,235,0.6)] flex items-center justify-center gap-3"
              >
                Start Generating
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-10 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full font-black text-lg transition-all"
              >
                Sign In
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
