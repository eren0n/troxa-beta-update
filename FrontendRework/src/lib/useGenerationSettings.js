import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { brandKitApi, creativesApi, fingerprintApi } from './api';
import { useCreativeGallery } from './useCreativeGallery';
import { EMPTY_CREATIVE_FILTERS } from '../components/dashboard/CreativeFilterBar';
import { ratioToOption } from './generationOptions';

const REFERENCE_PAGE_SIZE = 12;

/**
 * Everything Generate and Automation's pipeline builder need to configure
 * an AI generation: mode, model, reference photos, campaign + Campaign
 * Intel, Trend Scout, character, aspect ratios, logo, fingerprint blend,
 * simplicity — plus the effects/handlers that drive them.
 *
 * This used to be ~35 useState calls copy-pasted between
 * GenerateCreativesV2.jsx and Automation.jsx's create/edit form, so a field
 * added to one silently never showed up in the other (the model list was a
 * real example: Automation offered 3 of 7 models, at different credit
 * costs, until this hook existed). Both pages now call this ONE hook and
 * render <GenerationSettingsPanel> against its return value — there is
 * nowhere left for the two to drift apart.
 *
 * `initial` pre-fills from an existing Automation (or any object shaped
 * like the GeneratedCreative/Automation API response) — omit it for a
 * fresh Generate session.
 */
export function useGenerationSettings(initial = {}) {
  const { activeWorkspace } = useAuth();

  // ── Core settings ──
  const [mode, setMode] = useState(initial.generation_mode || 'auto');
  const [selectedStatics, setSelectedStatics] = useState(initial.static_ids || []);
  const [selectedModel, setSelectedModel] = useState(initial.model_name || 'Nano Banana 2');
  const [ratios, setRatios] = useState(() => {
    if (initial.aspect_ratios?.length) return initial.aspect_ratios.map(ratioToOption);
    if (initial.aspect_ratio) return [ratioToOption(initial.aspect_ratio)];
    return ['1:1 — Square', '9:16 — Story'];
  });
  const [numImages, setNumImages] = useState(initial.num_images ?? 1);
  const [extraPrompt, setExtraPrompt] = useState(initial.extra_prompt || '');
  const [negativePrompt, setNegativePrompt] = useState(initial.negative_prompt || '');
  const [selectedDisclaimer, setSelectedDisclaimer] = useState(initial.disclaimer_id ? String(initial.disclaimer_id) : '');
  const [disclaimers, setDisclaimers] = useState([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState(initial.character_id ? String(initial.character_id) : '');
  const [blendWeight, setBlendWeight] = useState(initial.blend_weight ?? 50);
  const [simplicityMode, setSimplicityMode] = useState(initial.simplicity_weight != null);
  const [simplicityWeight, setSimplicityWeight] = useState(initial.simplicity_weight ?? 50);
  const useFingerprint = true; // always on — no user toggle, matches Generate's long-standing behavior

  // ── Reference data ──
  const [allTags, setAllTags] = useState([]);
  const [contributorsList, setContributorsList] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [fingerprintStatus, setFingerprintStatus] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [brandKitLogos, setBrandKitLogos] = useState([]);
  const [defaultLogoId, setDefaultLogoId] = useState(null);
  const [selectedLogoId, setSelectedLogoId] = useState(initial.logo_id || null);
  const [showLogoModal, setShowLogoModal] = useState(false);

  // ── Campaign ──
  const [selectedCampaignId, setSelectedCampaignId] = useState(initial.campaign_id ? String(initial.campaign_id) : '');
  const [isAddingCampaign, setIsAddingCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');

  // ── Campaign Intelligence ──
  const [campaignIntel, setCampaignIntel] = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelResearching, setIntelResearching] = useState(false);
  const [selectedBriefId, setSelectedBriefId] = useState(null);
  const [intelBriefs, setIntelBriefs] = useState([]);
  const [editingCampaignDetails, setEditingCampaignDetails] = useState(false);
  const [campaignEditData, setCampaignEditData] = useState({ target_audience: '', target_region: '', objective: '', campaign_brief: '' });
  const intelPollRef = useRef(null);

  // ── Trend Scout ──
  const [trendBrief, setTrendBrief] = useState(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [activeTrendIdeaId, setActiveTrendIdeaId] = useState(null);
  const trendPollRef = useRef(null);

  // ── @mention (character insertion in Extra Instructions) ──
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionIdx, setMentionIdx] = useState(0);
  const extraPromptRef = useRef(null);

  // ── Reference photo picker ──
  const [uploadingStatic, setUploadingStatic] = useState(false);
  const [uploadNotice, setUploadNotice] = useState(null);
  const staticInputRef = useRef(null);
  // Reference material only — Brand Kit → References is what this grid is a
  // view of, not the whole gallery.
  const [referenceFilters, setReferenceFilters] = useState({
    ...EMPTY_CREATIVE_FILTERS, mediaType: 'Photo', isReference: 'true',
  });
  const {
    creatives: referenceCreatives, setCreatives: setReferenceCreatives,
    loading: loadingReferences, hasMore: hasMoreReferences, sentinelRef: referencesSentinelRef,
  } = useCreativeGallery(referenceFilters, allTags, { pageSize: REFERENCE_PAGE_SIZE });

  // ── Initial data load ──
  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      try {
        const [t, c, l, d, ctr, chars, fp] = await Promise.allSettled([
          creativesApi.tags(),
          brandKitApi.campaigns(),
          brandKitApi.logos(),
          brandKitApi.disclaimers(),
          creativesApi.contributors(),
          brandKitApi.characters(),
          fingerprintApi.status(),
        ]);
        if (t.status === 'fulfilled') setAllTags(t.value?.results || t.value || []);
        if (c.status === 'fulfilled') setCampaigns(c.value?.results || c.value || []);
        if (l.status === 'fulfilled') {
          const logos = l.value?.results || l.value || [];
          setBrandKitLogos(logos);
          const primary = logos.find(lg => lg.is_primary) || logos[0] || null;
          if (primary) setDefaultLogoId(primary.id);
        }
        if (d.status === 'fulfilled') setDisclaimers(d.value?.results || d.value || []);
        if (ctr.status === 'fulfilled') setContributorsList(ctr.value?.results || ctr.value || []);
        if (chars.status === 'fulfilled') setCharacters(Array.isArray(chars.value) ? chars.value : []);
        if (fp.status === 'fulfilled') setFingerprintStatus(fp.value);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [activeWorkspace]);

  // ── Trend Scout fetch + polling ──
  const stopTrendPoll = useCallback(() => {
    if (trendPollRef.current) { clearInterval(trendPollRef.current); trendPollRef.current = null; }
  }, []);

  const fetchTrendBrief = useCallback(async (showLoading = false) => {
    if (showLoading) setTrendLoading(true);
    try {
      const data = await fingerprintApi.trendsGet();
      setTrendBrief(data);
      if (data?.status === 'pending') {
        if (!trendPollRef.current) {
          trendPollRef.current = setInterval(async () => {
            try {
              const polled = await fingerprintApi.trendsGet();
              setTrendBrief(polled);
              if (polled?.status !== 'pending') stopTrendPoll();
            } catch (_) {}
          }, 5000);
        }
      } else {
        stopTrendPoll();
      }
    } catch (_) {}
    finally { if (showLoading) setTrendLoading(false); }
  }, [stopTrendPoll]);

  useEffect(() => {
    if (!activeWorkspace) return;
    fetchTrendBrief(true);
    return () => stopTrendPoll();
  }, [activeWorkspace, fetchTrendBrief, stopTrendPoll]);

  const handleRefreshTrends = async () => {
    setTrendLoading(true);
    setActiveTrendIdeaId(null);
    try {
      await fingerprintApi.trendsRefresh();
      setTrendBrief(prev => ({ ...prev, status: 'pending', ideas: [] }));
      stopTrendPoll();
      trendPollRef.current = setInterval(async () => {
        try {
          const polled = await fingerprintApi.trendsGet();
          setTrendBrief(polled);
          if (polled?.status !== 'pending') { stopTrendPoll(); setTrendLoading(false); }
        } catch (_) {}
      }, 5000);
    } catch (_) { setTrendLoading(false); }
  };

  const handleSelectTrendIdea = (idea) => {
    setActiveTrendIdeaId(prev => prev === idea.id ? null : idea.id);
  };

  // ── Campaign Intel fetch + polling ──
  const stopIntelPoll = useCallback(() => {
    if (intelPollRef.current) { clearInterval(intelPollRef.current); intelPollRef.current = null; }
  }, []);

  const loadIntelBriefs = useCallback(async (campaignId) => {
    try {
      const data = await fingerprintApi.campaignBriefs(campaignId);
      if (data?.briefs?.length) setIntelBriefs(data.briefs);
    } catch (_) {}
  }, []);

  const fetchIntel = useCallback(async (campaignId, silent = false) => {
    if (!campaignId) { setCampaignIntel(null); setIntelBriefs([]); setSelectedBriefId(null); return; }
    if (!silent) setIntelLoading(true);
    try {
      const data = await fingerprintApi.campaignIntel(campaignId);
      setCampaignIntel(data);
      if (data.brief_status === 'ready' && data.brief_count > 0) await loadIntelBriefs(campaignId);
    } catch (_) {}
    finally { if (!silent) setIntelLoading(false); }
  }, [loadIntelBriefs]);

  useEffect(() => {
    stopIntelPoll();
    setCampaignIntel(null);
    setIntelBriefs([]);
    setSelectedBriefId(null);
    setEditingCampaignDetails(false);
    if (!selectedCampaignId) return;
    fetchIntel(selectedCampaignId);
    const camp = campaigns.find(c => c.id === selectedCampaignId);
    if (camp) {
      setCampaignEditData({
        target_audience: camp.target_audience || '',
        target_region: camp.target_region || '',
        objective: camp.objective || '',
        campaign_brief: camp.campaign_brief || '',
      });
    }
  }, [selectedCampaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    stopIntelPoll();
    if (!selectedCampaignId || !campaignIntel) return;
    const isPending = campaignIntel.research_status === 'pending' || campaignIntel.brief_status === 'pending';
    if (!isPending) return;
    intelPollRef.current = setInterval(async () => {
      try {
        const data = await fingerprintApi.campaignIntel(selectedCampaignId);
        setCampaignIntel(data);
        if (data.brief_status === 'ready' && data.brief_count > 0) {
          await loadIntelBriefs(selectedCampaignId);
          stopIntelPoll();
        } else if (data.research_status === 'failed' || data.brief_status === 'failed') {
          stopIntelPoll();
        }
      } catch (_) {}
    }, 8000);
    return stopIntelPoll;
  }, [campaignIntel?.research_status, campaignIntel?.brief_status, selectedCampaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCampaignDetails = async () => {
    if (!selectedCampaignId) return;
    try {
      const updated = await brandKitApi.updateCampaign(selectedCampaignId, campaignEditData);
      setCampaigns(prev => prev.map(c => c.id === selectedCampaignId ? { ...c, ...updated } : c));
      setEditingCampaignDetails(false);
      fetchIntel(selectedCampaignId);
    } catch (_) {}
  };

  const handleStartResearch = async () => {
    if (!selectedCampaignId || intelResearching) return;
    setIntelResearching(true);
    try { await fingerprintApi.campaignResearch(selectedCampaignId); await fetchIntel(selectedCampaignId); }
    catch (_) {}
    finally { setIntelResearching(false); }
  };

  const handleRebrief = async () => {
    if (!selectedCampaignId) return;
    try {
      await fingerprintApi.campaignRebriefs(selectedCampaignId);
      setCampaignIntel(prev => prev ? { ...prev, brief_status: 'pending' } : prev);
    } catch (_) {}
  };

  const handleSelectBrief = (brief) => {
    if (selectedBriefId === brief.id) { setSelectedBriefId(null); setExtraPrompt(''); return; }
    setSelectedBriefId(brief.id);
    setExtraPrompt(brief.extra_prompt || '');
    // fingerprint is always on — nothing else to toggle here
  };

  const addCampaign = async () => {
    if (!newCampaignName.trim()) return;
    try {
      const created = await brandKitApi.createCampaign(newCampaignName.trim());
      setCampaigns(prev => [...prev, created]);
      setSelectedCampaignId(created.id);
    } catch (_) {}
    setNewCampaignName('');
    setIsAddingCampaign(false);
  };

  // ── @mention helpers ──
  const mentionMatches = characters.filter(c => c.name.toLowerCase().startsWith(mentionQuery.toLowerCase()));

  const insertMention = (char) => {
    const before = extraPrompt.slice(0, mentionStart);
    const after = extraPrompt.slice(mentionStart + 1 + mentionQuery.length);
    setExtraPrompt(before + '@[' + char.name + ']' + after);
    setMentionOpen(false);
    setTimeout(() => extraPromptRef.current?.focus(), 0);
  };

  const handleExtraPromptChange = (e) => {
    const val = e.target.value;
    setExtraPrompt(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const m = before.match(/@(\w*)$/);
    if (m && characters.length > 0) {
      setMentionStart(before.length - m[0].length);
      setMentionQuery(m[1]);
      setMentionOpen(true);
      setMentionIdx(0);
    } else {
      setMentionOpen(false);
    }
  };

  const handleExtraPromptKeyDown = (e) => {
    if (!mentionOpen || !mentionMatches.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionMatches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); insertMention(mentionMatches[mentionIdx]); }
    else if (e.key === 'Escape') { setMentionOpen(false); }
  };

  // ── Reference photos ──
  const toggleStatic = (id) => setSelectedStatics(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleStaticUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingStatic(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const created = await creativesApi.upload(fd);
        setReferenceCreatives(prev => [{ ...created, thumbnail: created.thumbnail || created.image_url }, ...prev]);
      } catch (_) {}
    }
    e.target.value = '';
    setUploadingStatic(false);
  };

  const handleCreativeUploaded = (created) => {
    setUploadNotice('Uploaded to your creative library.');
    setReferenceCreatives(prev => [{ ...created, thumbnail: created.thumbnail || created.image_url }, ...prev]);
  };

  // ── Shared payload fields — both creativesApi.generate() (one call per
  // ratio) and the Automation create/update payload build on top of this. ──
  const buildBasePayload = () => ({
    generation_mode: mode,
    static_ids: selectedStatics,
    character_id: selectedCharacterId || null,
    model_name: mode === 'auto' ? 'GPT Image 2' : selectedModel,
    num_images: numImages,
    resolution: '1K',
    output_format: 'png',
    campaign_id: selectedCampaignId || null,
    // '' not null: Automation's extra_prompt/style columns aren't
    // nullable, and its create/update views only coerce a *missing* key
    // to '' — an explicit null makes it through to .save() and raises
    // an IntegrityError (500). Empty string round-trips cleanly on both
    // Generate's endpoint (already tolerant of either) and Automation's.
    extra_prompt: extraPrompt || '',
    negative_prompt: negativePrompt || '',
    disclaimer_id: selectedDisclaimer || null,
    use_fingerprint: useFingerprint,
    blend_weight: blendWeight,
    simplicity_mode: simplicityMode,
    simplicity_weight: simplicityMode ? simplicityWeight : null,
    logo_id: mode === 'auto' ? (defaultLogoId || null) : (selectedLogoId || null),
  });

  return {
    // core
    mode, setMode,
    selectedModel, setSelectedModel,
    ratios, setRatios,
    numImages, setNumImages,
    extraPrompt, setExtraPrompt, extraPromptRef,
    negativePrompt, setNegativePrompt,
    selectedDisclaimer, setSelectedDisclaimer, disclaimers,
    selectedCharacterId, setSelectedCharacterId,
    blendWeight, setBlendWeight,
    simplicityMode, setSimplicityMode,
    simplicityWeight, setSimplicityWeight,
    useFingerprint,

    // data
    loadingData,
    allTags, contributorsList,
    campaigns, characters, fingerprintStatus,
    brandKitLogos, defaultLogoId, selectedLogoId, setSelectedLogoId, showLogoModal, setShowLogoModal,

    // campaign
    selectedCampaignId, setSelectedCampaignId,
    isAddingCampaign, setIsAddingCampaign, newCampaignName, setNewCampaignName, addCampaign,

    // campaign intel
    campaignIntel, intelLoading, intelResearching, intelBriefs, selectedBriefId,
    editingCampaignDetails, setEditingCampaignDetails, campaignEditData, setCampaignEditData,
    saveCampaignDetails, handleStartResearch, handleRebrief, handleSelectBrief,

    // trend scout
    trendBrief, trendLoading, activeTrendIdeaId, handleRefreshTrends, handleSelectTrendIdea,

    // mention
    mentionOpen, setMentionOpen, mentionMatches, mentionIdx,
    handleExtraPromptChange, handleExtraPromptKeyDown, insertMention,

    // reference photos
    selectedStatics, setSelectedStatics, toggleStatic,
    referenceCreatives, setReferenceCreatives, loadingReferences, hasMoreReferences, referencesSentinelRef,
    referenceFilters, setReferenceFilters,
    uploadingStatic, uploadNotice, setUploadNotice, staticInputRef, handleStaticUpload, handleCreativeUploaded,

    buildBasePayload,
  };
}
