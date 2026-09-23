import { AnimatePresence, motion } from 'motion/react';
import {
  Check, Plus, X, Image as ImageIcon, ChevronDown, Info, Wand2, Sliders,
  PenLine, AlertTriangle, Loader2, Brain, RefreshCw, TrendingUp, Users, Flame,
  Sparkles, CheckCircle2, Link as LinkIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { GLASS_STYLE } from '../ui/GlassCard';
import { CreativeGridSkeleton } from '../ui/Skeleton';
import { CreativeImg } from '../ui/CreativeImg';
import CreativeFilterBar from './CreativeFilterBar';
import { MODELS, RATIO_OPTIONS, BRIEF_TYPE_META } from '../../lib/generationOptions';

/**
 * The full "configure a generation" experience — reference photo grid,
 * mode switcher, campaign + Campaign Intel, Trend Scout, character/model
 * pickers, aspect ratio + image count, extra instructions with @mention,
 * logo, Brand Fingerprint blend, Simplicity — rendered from a single
 * `useGenerationSettings()` hook instance.
 *
 * Used by both the Generate tab (one-off generation) and the Automation
 * pipeline builder (saved, recurring config) so the two can never drift
 * apart again — a field added here shows up in both places automatically.
 * The actual submit button/credit summary is caller-supplied via `footer`
 * since what happens after submit genuinely differs between the two
 * (Generate shows a live progress screen; Automation saves and returns to
 * the pipeline list).
 */
export default function GenerationSettingsPanel({ settings: s, footer }) {
  // A campaign brief and a daily trend idea are mutually exclusive in effect:
  // a trend idea is turned into a prebuilt master prompt, and the backend then
  // skips the DNA build entirely — which is where a brief's text would have
  // been used. Picking both silently threw one away, so each hides the other's
  // options while it is selected. The trend idea only counts in auto mode,
  // because that is the only mode that acts on it; without that check a
  // leftover selection would keep the briefs hidden in custom mode with no
  // visible trend card left to deselect.
  const trendIdeaActive = s.mode === 'auto' && !!s.activeTrendIdeaId;
  const briefSelected = !!s.selectedBriefId;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* ── Reference Photo Grid — below lg this renders after the settings
          panel (order-2) since it can grow indefinitely via infinite
          scroll, which would otherwise push the settings out of reach. ── */}
      <div style={GLASS_STYLE} className="flex-1 rounded-2xl overflow-hidden flex flex-col min-h-96 order-2 lg:order-1 w-full">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ImageIcon className={`w-4 h-4 ${s.selectedCharacterId ? 'text-slate-700' : 'text-slate-500'}`} />
            <h2 className={`font-black text-sm ${s.selectedCharacterId ? 'text-slate-600' : 'text-white'}`}>Reference Photos</h2>
            {s.selectedCharacterId && <span className="text-[10px] text-slate-600 font-normal">overridden by character</span>}
          </div>
          <div className="flex items-center gap-3">
            {s.selectedStatics.length > 0 && (
              <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                {s.selectedStatics.length} selected
              </motion.span>
            )}
            <AnimatePresence>
              {s.selectedStatics.length > 0 && (
                <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => s.setSelectedStatics([])} className="text-[10px] uppercase font-semibold text-red-500/60 hover:text-red-500/80 transition-colors">
                  Clear
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-white/5">
          <CreativeFilterBar
            filters={s.referenceFilters}
            onChange={s.setReferenceFilters}
            campaignsList={s.campaigns}
            allTags={s.allTags}
            contributorsList={s.contributorsList}
            showMediaType={false}
            searchPlaceholder="Search reference photos..."
          />
        </div>

        <div className="flex-1 p-5">
          {s.loadingReferences ? (
            <CreativeGridSkeleton count={8} columns="grid-cols-2 md:grid-cols-3 xl:grid-cols-4" gap="gap-3" cardRounded="rounded-xl" showMeta={false} glass={false} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {s.referenceCreatives.map((item) => {
                const selected = s.selectedStatics.includes(item.id);
                const captioning = item.caption_status === 'pending' || item.caption_status === 'processing';
                return (
                  <motion.div key={item.id} onClick={() => s.toggleStatic(item.id)}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className={`group relative rounded-xl overflow-hidden aspect-4/5 cursor-pointer border-2 transition-all ${selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent hover:border-white/15'}`}>
                    <CreativeImg creativeId={item.id}
                      className={`w-full h-full object-cover transition-all duration-300 ${selected ? 'opacity-100' : 'opacity-55 group-hover:opacity-85'}`}
                      alt={item.name} loading="lazy" decoding="async" />
                    <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
                    {captioning && (
                      <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-black/60 text-slate-300 backdrop-blur-sm flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Captioning
                      </span>
                    )}
                    <AnimatePresence>
                      {selected && (
                        <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                          className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-md flex items-center justify-center shadow-lg shadow-blue-600/50 border border-blue-400/40">
                          <Check className="w-3 h-3 text-white stroke-3" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}

              <input ref={s.staticInputRef} type="file" accept="image/*" multiple className="hidden" onChange={s.handleStaticUpload} />
              <button type="button" onClick={() => s.staticInputRef.current?.click()} disabled={s.uploadingStatic}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/8 hover:border-blue-500/30 hover:bg-blue-500/4 transition-all group aspect-4/5 cursor-pointer disabled:opacity-60">
                <div className="w-10 h-10 rounded-xl bg-white/4 group-hover:bg-blue-500/10 border border-white/6 group-hover:border-blue-500/20 flex items-center justify-center mb-2 transition-all">
                  {s.uploadingStatic ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> : <Plus className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />}
                </div>
                <span className="text-[9px] font-black text-slate-700 group-hover:text-blue-400 uppercase tracking-widest transition-colors text-center">{s.uploadingStatic ? 'Uploading…' : 'Add Reference'}</span>
              </button>
            </div>
          )}
          {!s.loadingReferences && s.hasMoreReferences && (
            <div ref={s.referencesSentinelRef} className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* ── Settings Panel ── */}
      <div className="w-full lg:w-96 space-y-4 order-1 lg:order-2 shrink-0">
        {/* Mode Switcher */}
        <div style={GLASS_STYLE} className="rounded-2xl p-1.5 flex gap-1.5">
          {[{ key: 'auto', label: 'Auto', Icon: Wand2 }, { key: 'custom', label: 'Custom', Icon: Sliders }].map(({ key, label, Icon }) => (
            <button key={key} onClick={() => s.setMode(key)}
              className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${s.mode === key ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}>
              {s.mode === key && (
                <motion.div layoutId="gen-mode-pill" className="absolute inset-0 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/25" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              <Icon className="relative w-3.5 h-3.5" />
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>

        {/* Campaign Selector */}
        <div style={GLASS_STYLE} className="rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Campaign</label>
            <button type="button" onClick={() => s.setIsAddingCampaign(!s.isAddingCampaign)} className="text-[10px] font-black text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors uppercase tracking-wider">
              {s.isAddingCampaign ? 'Cancel' : '+ New'}
            </button>
          </div>
          <AnimatePresence mode="wait">
            {s.isAddingCampaign ? (
              <motion.div key="adding" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex gap-2">
                <input type="text" value={s.newCampaignName} onChange={(e) => s.setNewCampaignName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && s.addCampaign()} placeholder="Campaign name..." className="flex-1 bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-xl py-2.5 px-3 text-sm text-white outline-none transition-all placeholder:text-slate-700" />
                <button onClick={s.addCampaign} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition-all">Add</button>
                <button onClick={() => { s.setIsAddingCampaign(false); s.setNewCampaignName(''); }} className="p-2 bg-white/5 border border-white/8 text-slate-400 hover:text-white rounded-xl transition-all"><X className="w-4 h-4" /></button>
              </motion.div>
            ) : (
              <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
                <select value={s.selectedCampaignId} onChange={(e) => s.setSelectedCampaignId(e.target.value)} className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3 px-4 text-sm text-white outline-none appearance-none cursor-pointer transition-all">
                  <option value="">— No campaign —</option>
                  {s.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Campaign Intelligence */}
        <AnimatePresence>
          {s.selectedCampaignId && (
            <motion.div key="intel-panel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
              style={GLASS_STYLE} className="rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><Brain className="w-3 h-3 text-blue-400" /></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Campaign Intel</span>
                </div>
                <div className="flex items-center gap-2">
                  {s.campaignIntel?.has_audience && !s.editingCampaignDetails && (
                    <button onClick={() => {
                      const camp = s.campaigns.find(c => c.id === s.selectedCampaignId);
                      if (camp) s.setCampaignEditData({ target_audience: camp.target_audience || '', target_region: camp.target_region || '', objective: camp.objective || '', campaign_brief: camp.campaign_brief || '' });
                      s.setEditingCampaignDetails(true);
                    }} className="text-[10px] font-black text-slate-600 hover:text-slate-400 flex items-center gap-1 transition-colors uppercase tracking-wider">
                      <PenLine className="w-3 h-3" /> Edit
                    </button>
                  )}
                  {s.campaignIntel?.brief_status === 'ready' && s.campaignIntel?.fingerprint_stale && !s.editingCampaignDetails && (
                    <button onClick={s.handleRebrief} className="text-[10px] font-black text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors uppercase tracking-wider">
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  )}
                </div>
              </div>

              {s.intelLoading && (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                  <span className="text-xs text-slate-600">Loading intelligence…</span>
                </div>
              )}

              {!s.intelLoading && s.campaignIntel && (!s.campaignIntel.has_audience || s.editingCampaignDetails) && (
                <div className="space-y-2 pt-0.5">
                  {!s.campaignIntel.has_audience && <p className="text-[10px] text-slate-600">Target audience is required to start research.</p>}
                  <textarea rows={2} value={s.campaignEditData.target_audience} onChange={(e) => s.setCampaignEditData(prev => ({ ...prev, target_audience: e.target.value }))}
                    placeholder="Target audience (e.g. 25-35 male, sports fans...)"
                    className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl p-2.5 text-xs text-white outline-none transition-all resize-none placeholder:text-slate-700" />
                  <input type="text" value={s.campaignEditData.target_region} onChange={(e) => s.setCampaignEditData(prev => ({ ...prev, target_region: e.target.value }))}
                    placeholder="Target region (e.g. UK, US, MENA...)"
                    className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-2.5 px-3 text-xs text-white outline-none transition-all placeholder:text-slate-700" />
                  <div className="relative">
                    <select value={s.campaignEditData.objective} onChange={(e) => s.setCampaignEditData(prev => ({ ...prev, objective: e.target.value }))}
                      className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-2.5 px-3 text-xs text-white outline-none appearance-none cursor-pointer transition-all">
                      <option value="">Select objective...</option>
                      <option value="acquisition">Acquisition</option>
                      <option value="retention">Retention</option>
                      <option value="awareness">Brand Awareness</option>
                      <option value="reactivation">Reactivation</option>
                      <option value="event">Event / Seasonal</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
                  </div>
                  <textarea rows={2} value={s.campaignEditData.campaign_brief} onChange={(e) => s.setCampaignEditData(prev => ({ ...prev, campaign_brief: e.target.value }))}
                    placeholder="Campaign brief (optional)"
                    className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl p-2.5 text-xs text-white outline-none transition-all resize-none placeholder:text-slate-700" />
                  <div className="flex gap-2">
                    <button onClick={s.saveCampaignDetails} disabled={!s.campaignEditData.target_audience.trim()}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-xs rounded-xl transition-all">Save</button>
                    {s.editingCampaignDetails && (
                      <button onClick={() => s.setEditingCampaignDetails(false)} className="px-3 py-2 bg-white/5 border border-white/8 text-slate-400 hover:text-white text-xs rounded-xl transition-all">Cancel</button>
                    )}
                  </div>
                </div>
              )}

              {!s.intelLoading && s.campaignIntel?.has_audience && s.campaignIntel?.research_status === null && (
                <button onClick={s.handleStartResearch} disabled={s.intelResearching}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500/8 border border-blue-500/20 hover:bg-blue-500/12 hover:border-blue-500/30 rounded-xl text-xs font-black text-blue-400 transition-all disabled:opacity-60">
                  {s.intelResearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                  Start market research
                </button>
              )}

              {!s.intelLoading && (s.campaignIntel?.research_status === 'pending' || (s.campaignIntel?.research_status === 'ready' && s.campaignIntel?.brief_status === 'pending')) && (
                <div className="flex items-center gap-2.5 py-1">
                  <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400 font-bold">{s.campaignIntel?.research_status === 'pending' ? 'Researching market…' : 'Preparing brief…'}</p>
                    <p className="text-[10px] text-slate-600">~20-40 seconds</p>
                  </div>
                </div>
              )}

              {!s.intelLoading && (s.campaignIntel?.research_status === 'failed' || s.campaignIntel?.brief_status === 'failed') && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] text-red-400">Research failed.</span>
                  <button onClick={s.handleStartResearch} className="text-[10px] font-black text-blue-400 hover:text-blue-300 transition-colors">Try again</button>
                </div>
              )}

              {!s.intelLoading && s.campaignIntel?.brief_status === 'ready' && s.campaignIntel?.fingerprint_stale && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-[10px] text-amber-400">Fingerprint updated — briefs may be outdated</span>
                </div>
              )}

              {!s.intelLoading && s.intelBriefs.length > 0 && !trendIdeaActive && (
                <div className="space-y-2 pt-1">
                  {s.intelBriefs.map((brief) => {
                    const meta = BRIEF_TYPE_META[brief.type] || BRIEF_TYPE_META['on-brand'];
                    const isSelected = s.selectedBriefId === brief.id;
                    const BriefIcon = meta.Icon;
                    return (
                      <motion.button key={brief.id} onClick={() => s.handleSelectBrief(brief)} whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.995 }}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${isSelected ? meta.color + ' ring-1 ring-inset ring-white/10' : 'border-white/6 hover:border-white/12 bg-white/2 hover:bg-white/4'}`}>
                        <div className="flex items-start gap-2.5">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? meta.chip.split(' ').slice(0, 2).join(' ') : 'bg-white/5'}`}>
                            <BriefIcon className={`w-3 h-3 ${isSelected ? meta.chip.split(' ')[1] : 'text-slate-600'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${meta.chip}`}>{meta.label}</span>
                              {brief.confidence === 'experimental' && <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20">Risk</span>}
                            </div>
                            <p className="text-xs font-black text-white truncate">{brief.title}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{brief.concept}</p>
                          </div>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                              <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                            </div>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                  <p className="text-[10px] text-slate-700 text-center pt-1">Select a brief → Extra Instructions auto-fills</p>
                </div>
              )}

              {!s.intelLoading && s.intelBriefs.length > 0 && trendIdeaActive && (
                <p className="text-[10px] text-slate-600 leading-relaxed pt-1">
                  Briefs are hidden while a daily trend idea is selected — deselect it to generate from a brief instead.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auto mode: output settings */}
        {s.mode === 'auto' && (
          <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-2.5 px-3.5 py-3 bg-blue-500/5 border border-blue-500/12 rounded-xl">
              <Wand2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-500 leading-relaxed">AI automatically selects model, format, and output settings.</p>
            </div>
            <AspectRatioSelector ratios={s.ratios} onChange={s.setRatios} />
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Images per Reference</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} onClick={() => s.setNumImages(n)} className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${s.numImages === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/4 border border-white/6 text-slate-500 hover:text-white hover:border-white/10'}`}>{n}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Auto mode: Trend Scout — the whole block is a picker, so a selected
            campaign brief hides all of it rather than just the cards. */}
        {s.mode === 'auto' && !briefSelected && (
          <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center"><Flame className="w-3 h-3 text-orange-400" /></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Daily Trend Ideas</span>
                {s.trendBrief?.status === 'ready' && s.trendBrief.ideas?.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/15 text-orange-400 font-black">{s.trendBrief.ideas.length} ideas</span>
                )}
                {s.trendBrief?.stale && s.trendBrief?.status === 'ready' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/8 text-slate-500 font-black">A day old</span>
                )}
              </div>
              <button onClick={s.handleRefreshTrends} disabled={s.trendLoading || s.trendBrief?.status === 'pending'}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                <RefreshCw className={`w-3 h-3 ${s.trendLoading || s.trendBrief?.status === 'pending' ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {(s.trendLoading || s.trendBrief?.status === 'pending') && (
              <div className="flex items-center gap-2 py-1">
                <Loader2 className="w-3 h-3 text-orange-400 animate-spin shrink-0" />
                <span className="text-[10px] text-slate-500">Researching trends...</span>
              </div>
            )}

            {s.trendBrief?.status === 'ready' && s.trendBrief.ideas?.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {s.trendBrief.ideas.map(idea => {
                  const isActive = s.activeTrendIdeaId === idea.id;
                  return (
                    <button key={idea.id} onClick={() => s.handleSelectTrendIdea(idea)}
                      className={`shrink-0 w-36 text-left p-2 rounded-xl border transition-all ${isActive ? 'bg-orange-500/12 border-orange-500/40' : 'bg-white/3 border-white/6 hover:border-white/12 hover:bg-white/5'}`}>
                      <p className={`text-[10px] font-black leading-tight mb-1 ${isActive ? 'text-orange-300' : 'text-white'}`}>{idea.theme}</p>
                      <p className="text-[9px] text-slate-500 leading-relaxed line-clamp-2">{idea.concept}</p>
                      <p className="mt-1.5 text-[9px] font-black uppercase tracking-wide">
                        {isActive ? <span className="text-orange-400 flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5 inline" /> Selected</span> : <span className="text-slate-600">Select →</span>}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {s.trendBrief?.status === 'failed' && !s.trendLoading && (
              <p className="text-xs text-red-400">Trend research failed. Click Refresh to retry.</p>
            )}

            {!s.trendLoading && !s.trendBrief?.status && (
              <p className="text-[10px] text-slate-600 leading-relaxed">
                No ideas scouted yet — hit Refresh to pull today's trends.
              </p>
            )}
          </div>
        )}

        {/* Custom mode: Character + Model + Settings */}
        {s.mode === 'custom' && (
          <>
            {s.characters.length > 0 && (
              <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center"><Sparkles className="w-3 h-3 text-violet-400" /></div>
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Character</span>
                  <span className="text-[10px] text-slate-700 font-normal normal-case tracking-normal">(optional)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => s.setSelectedCharacterId('')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${!s.selectedCharacterId ? 'bg-white/8 border-white/15 text-white' : 'border-white/6 text-slate-500 hover:text-slate-300 hover:border-white/10'}`}>
                    None
                  </button>
                  {s.characters.map(char => (
                    <button key={char.id} onClick={() => s.setSelectedCharacterId(s.selectedCharacterId === char.id ? '' : char.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${s.selectedCharacterId === char.id ? 'bg-violet-500/15 border-violet-500/30 text-violet-300' : 'border-white/6 text-slate-400 hover:text-white hover:border-white/12'}`}>
                      {char.name}
                      {char.images?.length > 0 && <span className="text-[9px] opacity-60">{char.images.length} img</span>}
                    </button>
                  ))}
                </div>
                {s.selectedCharacterId && <p className="text-[10px] text-violet-400/70">Reference photos overridden by character</p>}
              </div>
            )}

            <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-3">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">AI Model</label>
              <div className="space-y-2">
                {MODELS.map((model) => (
                  <motion.button key={model.name} whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.995 }} onClick={() => s.setSelectedModel(model.name)}
                    className={`w-full p-3.5 text-left border rounded-xl transition-all flex items-center justify-between ${s.selectedModel === model.name ? 'border-blue-500 bg-blue-500/6' : 'border-white/6 hover:border-white/10'}`}>
                    <div>
                      <p className="text-sm font-black text-white">{model.name}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{model.meta}</p>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${model.badgeColor}`}>{model.badge}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-4">
              <AspectRatioSelector ratios={s.ratios} onChange={s.setRatios} />
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Images per Reference</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} onClick={() => s.setNumImages(n)} className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${s.numImages === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/4 border border-white/6 text-slate-500 hover:text-white hover:border-white/10'}`}>{n}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  Extra Instructions <span className="text-slate-700 normal-case font-normal">(optional{s.characters.length > 0 ? ' — type @ to mention a character' : ''})</span>
                </label>
                <div className="relative">
                  <textarea ref={s.extraPromptRef} rows={3} value={s.extraPrompt}
                    onChange={s.handleExtraPromptChange} onKeyDown={s.handleExtraPromptKeyDown}
                    onBlur={() => setTimeout(() => s.setMentionOpen(false), 150)}
                    placeholder="Additional instructions..."
                    className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl p-3 text-sm text-white outline-none transition-all resize-none placeholder:text-slate-700" />
                  {s.mentionOpen && s.mentionMatches.length > 0 && (
                    <div className="absolute z-50 top-full left-0 mt-1 w-full bg-[#0c0f1a] border border-white/12 rounded-xl overflow-hidden shadow-xl shadow-black/40">
                      {s.mentionMatches.map((char, i) => (
                        <button key={char.id} onMouseDown={(e) => { e.preventDefault(); s.insertMention(char); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${i === s.mentionIdx ? 'bg-violet-500/15 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                          <div className="w-5 h-5 rounded-md bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0"><Sparkles className="w-2.5 h-2.5 text-violet-400" /></div>
                          <span className="text-xs font-bold">{char.name}</span>
                          {char.images?.length > 0 && <span className="text-[10px] text-slate-600 ml-auto">{char.images.length} img</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Negative Prompt <span className="text-slate-700 normal-case font-normal">(optional)</span></label>
                <textarea rows={2} value={s.negativePrompt} onChange={(e) => s.setNegativePrompt(e.target.value)} placeholder="What to avoid: blur, text, watermark..."
                  className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-red-500/50 rounded-xl p-3 text-sm text-white outline-none transition-all resize-none placeholder:text-slate-700" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Disclaimer Overlay <span className="text-slate-700 normal-case font-normal">(optional)</span></label>
                <div className="relative">
                  <select value={s.selectedDisclaimer} onChange={(e) => s.setSelectedDisclaimer(e.target.value)} className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3 px-4 text-sm text-white outline-none appearance-none cursor-pointer transition-all">
                    <option value="">None</option>
                    {s.disclaimers.map((d) => <option key={d.id} value={d.id}>{d.text?.substring(0, 40)}...</option>)}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                </div>
              </div>
              {/* Logo */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Logo <span className="text-slate-700 normal-case font-normal">(optional)</span></label>
                {(() => {
                  const sel = s.brandKitLogos.find(l => l.id === s.selectedLogoId);
                  return sel ? (
                    <div className="flex items-center gap-3 p-2.5 bg-white/4 border border-white/8 rounded-xl">
                      <img src={sel.file_url} alt={sel.name} className="w-10 h-10 object-contain rounded-lg bg-white/5 p-1 shrink-0" loading="lazy" decoding="async" />
                      <span className="flex-1 text-xs text-white truncate">{sel.name}</span>
                      <button onClick={() => s.setShowLogoModal(true)} className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors">Change</button>
                      <button onClick={() => s.setSelectedLogoId(null)} className="p-1 text-slate-500 hover:text-white transition-colors"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <button onClick={() => s.setShowLogoModal(true)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 bg-white/4 border border-dashed border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5 rounded-xl text-xs text-slate-500 hover:text-blue-400 font-black uppercase tracking-widest transition-all">
                      <Plus className="w-3.5 h-3.5" /> Add Logo
                    </button>
                  );
                })()}
              </div>
            </div>
          </>
        )}

        {/* Fingerprint + Simplicity — shared regardless of mode */}
        <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-3">
          {s.fingerprintStatus?.exists && s.fingerprintStatus?.has_visual_dna && (
            <div>
              <div className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${s.blendWeight > 0 ? 'bg-violet-500/10 border-violet-500/30' : 'bg-white/3 border-white/6'}`}>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${s.blendWeight > 0 ? 'bg-violet-400' : 'bg-slate-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-black transition-colors ${s.blendWeight > 0 ? 'text-violet-300' : 'text-slate-500'}`}>✦ Brand Fingerprint</p>
                  <p className="text-[10px] text-slate-600 truncate">
                    {s.blendWeight > 0 ? `Active · ${s.fingerprintStatus.confidence} confidence · ${s.fingerprintStatus.corpus_count} imgs` : 'Disabled — Pure References mode'}
                  </p>
                </div>
              </div>
              {(s.mode !== 'auto' || s.selectedStatics.length > 0) && (
                <div className="mt-2 px-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-slate-500 font-medium">References</span>
                    <span className="text-[10px] text-violet-400 font-black">
                      {s.blendWeight <= 20 ? 'Pure References' : s.blendWeight <= 45 ? 'Refs Dominant' : s.blendWeight <= 65 ? 'Balanced' : s.blendWeight <= 85 ? 'DNA Dominant' : 'Pure Brand DNA'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">Brand DNA</span>
                  </div>
                  <input type="range" min={0} max={100} step={5} value={s.blendWeight} onChange={e => s.setBlendWeight(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${s.blendWeight}%, rgba(255,255,255,0.08) ${s.blendWeight}%, rgba(255,255,255,0.08) 100%)` }} />
                </div>
              )}
            </div>
          )}

          <div>
            <button type="button" onClick={() => s.setSimplicityMode(v => !v)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${s.simplicityMode ? 'bg-sky-500/10 border-sky-500/30' : 'bg-white/3 border-white/6 hover:border-white/12'}`}>
              <div className={`rounded-full relative transition-colors shrink-0 ${s.simplicityMode ? 'bg-sky-500' : 'bg-white/10'}`} style={{ height: '18px', width: '32px' }}>
                <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${s.simplicityMode ? 'left-[14px]' : 'left-0.5'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-black ${s.simplicityMode ? 'text-sky-300' : 'text-slate-500'}`}>◈ Simplicity</p>
                <p className="text-[10px] text-slate-600 truncate">
                  {s.simplicityMode
                    ? s.simplicityWeight <= 20 ? 'Rich & Detailed' : s.simplicityWeight <= 40 ? 'Slightly Simplified' : s.simplicityWeight <= 60 ? 'Balanced' : s.simplicityWeight <= 80 ? 'Minimal' : 'Ultra Minimal'
                    : 'Control visual complexity of the output'}
                </p>
              </div>
            </button>
            {s.simplicityMode && (
              <div className="mt-2 px-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-slate-500 font-medium">Rich</span>
                  <span className="text-[10px] text-sky-400 font-black">
                    {s.simplicityWeight <= 20 ? 'Rich & Detailed' : s.simplicityWeight <= 40 ? 'Slightly Simplified' : s.simplicityWeight <= 60 ? 'Balanced' : s.simplicityWeight <= 80 ? 'Minimal' : 'Ultra Minimal'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">Minimal</span>
                </div>
                <input type="range" min={0} max={100} step={5} value={s.simplicityWeight} onChange={e => s.setSimplicityWeight(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, rgba(14,165,233,0.8) 0%, rgba(14,165,233,0.8) ${s.simplicityWeight}%, rgba(255,255,255,0.08) ${s.simplicityWeight}%, rgba(255,255,255,0.08) 100%)` }} />
              </div>
            )}
          </div>
        </div>

        {/* Caller-supplied CTA / credit summary — post-submit UX genuinely
            differs (Generate: live progress screen; Automation: save +
            return to list), so this stays outside the shared component. */}
        {footer}
      </div>

      {/* Logo picker modal */}
      <AnimatePresence>
        {s.showLogoModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-9999 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => s.setShowLogoModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }} className="bg-[#10141d] border border-white/8 rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Select Logo</h2>
                <button onClick={() => s.setShowLogoModal(false)} className="p-1.5 text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
              </div>
              {s.brandKitLogos.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <p className="text-sm text-slate-500">No logos in your Brand Kit yet.</p>
                  <Link to="/dashboard/brand-kit" onClick={() => s.setShowLogoModal(false)} className="inline-block text-xs font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors">Go to Brand Kit →</Link>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {s.brandKitLogos.map((logo) => {
                    const isSelected = s.selectedLogoId === logo.id;
                    return (
                      <button key={logo.id} onClick={() => { s.setSelectedLogoId(isSelected ? null : logo.id); s.setShowLogoModal(false); }}
                        className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${isSelected ? 'border-blue-500 bg-blue-500/10' : 'border-white/8 bg-white/3 hover:border-white/20 hover:bg-white/6'}`}>
                        <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
                          <img src={logo.file_url} alt={logo.name} className="w-full h-full object-contain p-2" loading="lazy" decoding="async" />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate w-full text-center">{logo.name}</span>
                        {isSelected && <div className="absolute top-2 right-2"><CheckCircle2 className="w-4 h-4 text-blue-400" /></div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AspectRatioSelector({ ratios, onChange }) {
  const canAdd = ratios.length < RATIO_OPTIONS.length;
  const addRatio = () => { const next = RATIO_OPTIONS.find(r => !ratios.includes(r)) || RATIO_OPTIONS[0]; onChange([...ratios, next]); };
  const removeRatio = (i) => onChange(ratios.filter((_, idx) => idx !== i));
  const updateRatio = (i, val) => onChange(ratios.map((r, idx) => idx === i ? val : r));
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Aspect Ratio</label>
        {canAdd && (
          <button type="button" onClick={addRatio} className="text-[10px] font-black text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors uppercase tracking-wider">
            <Plus className="w-3 h-3" /> Add more
          </button>
        )}
      </div>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {ratios.map((r, i) => (
            <motion.div key={i} initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: i > 0 ? 8 : 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={{ duration: 0.18 }} className="flex gap-2">
              <div className="relative flex-1">
                <select value={r} onChange={(e) => updateRatio(i, e.target.value)} className="w-full bg-[#0b0e1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3 px-4 text-sm text-white outline-none appearance-none cursor-pointer transition-all">
                  {RATIO_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
              </div>
              {ratios.length > 1 && (
                <button type="button" onClick={() => removeRatio(i)} className="w-11 h-11 rounded-xl bg-white/4 border border-white/6 hover:bg-red-500/10 hover:border-red-500/20 text-slate-600 hover:text-red-400 flex items-center justify-center transition-all shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {ratios.length > 1 && <p className="text-[10px] text-slate-700">{ratios.length} formats — each generates separately</p>}
    </div>
  );
}
