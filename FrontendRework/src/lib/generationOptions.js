import { Sparkles, TrendingUp, Users, Flame } from 'lucide-react';

// Single source of truth for the AI-generation option catalogs shown on the
// Generate tab and inside the Automation pipeline builder. These used to be
// hand-copied into Automation.jsx and drifted out of sync — e.g. Automation
// only offered 3 of these 7 models, at different (wrong) credit costs, and
// had no way to notice when Generate's list changed. Both surfaces import
// from here now, so there's exactly one list to update.
// First entry is the default a fresh Generate form starts on.
export const MODELS = [
  { name: 'GPT Image 2',      credits: 2, meta: 'Balanced',   badge: 'Recommended',  badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  { name: 'Nano Banana 2',    credits: 1, meta: 'Fast',       badge: 'Fast',         badgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' },
  { name: 'Nano Banana Pro',  credits: 2, meta: 'Premium',    badge: 'Pro',          badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' },
  { name: 'Grok Imagine',     credits: 1, meta: 'Ultra-fast', badge: 'Budget',       badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  { name: 'Seedream 5.0 Pro', credits: 2, meta: 'Premium',    badge: 'Pro',          badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' },
  { name: 'Ideogram v4',      credits: 1, meta: 'Fast',       badge: 'Fast',         badgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' },
  { name: 'Qwen Image 2 Pro', credits: 1, meta: 'Fast',       badge: 'Fast',         badgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' },
];

export const RATIO_OPTIONS  = ['1:1 — Square', '4:5 — Portrait', '9:16 — Story', '16:9 — Landscape'];
export const RES_OPTIONS    = ['1K Standard (~$0.08/img)', '2K Pro (~$0.15/img)', '4K Master (~$0.30/img)'];
export const FORMAT_OPTIONS = ['PNG', 'JPG', 'WebP'];

export const BRIEF_TYPE_META = {
  'on-brand'      : { label: 'On-Brand',      color: 'border-blue-500/40 bg-blue-500/5',     chip: 'bg-blue-500/15 text-blue-400 border-blue-500/30',     Icon: Sparkles },
  'trend-forward' : { label: 'Trend-Forward',  color: 'border-amber-500/40 bg-amber-500/5',   chip: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   Icon: TrendingUp },
  'audience-first': { label: 'Audience-First', color: 'border-green-500/40 bg-green-500/5',   chip: 'bg-green-500/15 text-green-400 border-green-500/30',   Icon: Users },
  'the-bet'       : { label: 'The Bet',        color: 'border-violet-500/40 bg-violet-500/5', chip: 'bg-violet-500/15 text-violet-400 border-violet-500/30', Icon: Flame },
};

// aspect_ratios come back from the API as bare '1:1' / '9:16' / ... — the
// <select> options carry a trailing " — Label"; this maps a bare ratio back
// to its full option string so pre-filling an edit form matches by value.
export function ratioToOption(r) {
  return RATIO_OPTIONS.find(o => o.startsWith(r + ' ')) || r;
}
