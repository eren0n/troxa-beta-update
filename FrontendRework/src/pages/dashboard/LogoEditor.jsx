import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, AlertCircle, Loader2, Trash2, Copy, RotateCcw } from 'lucide-react';
import { creativesApi, brandKitApi } from '../../lib/api';
import { loadFabric } from '../../lib/loadFabric';

const SNAP_PX = 14;

export default function LogoEditor() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  // ── Data state ──
  const [job, setJob] = useState(null);
  const [brandLogos, setBrandLogos] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  // ── UI state ──
  const [loading, setLoading] = useState(true);
  const [placementsLoading, setPlacementsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedImages, setSavedImages] = useState(null);

  // ── Controls for selected object ──
  const [activeScale, setActiveScale] = useState(1);
  const [activeOpacity, setActiveOpacity] = useState(1);
  const [activeAngle, setActiveAngle] = useState(0);
  const [hasSelection, setHasSelection] = useState(false);

  // ── Refs ──
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const containerRef = useRef(null);
  const wrapRef = useRef(null);
  const guideHRef = useRef(null);
  const guideVRef = useRef(null);
  const bgInfoRef = useRef(null);
  const logoMetaRef = useRef({});
  const savedRef = useRef({});
  const originalPlacementsRef = useRef({}); // OpenCV values, never overwritten by user edits
  const currentIdxRef = useRef(0);
  const jobRef = useRef(null);

  // ── Load data ──
  useEffect(() => {
    Promise.all([
      creativesApi.jobStatus(jobId),
      brandKitApi.getLogos(),
    ]).then(([jobData, logoData]) => {
      setJob(jobData);
      jobRef.current = jobData;
      setBrandLogos(Array.isArray(logoData) ? logoData : []);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [jobId]);

  // ── Init Fabric.js after job loads (Fabric itself loads on demand) ──
  useEffect(() => {
    if (!job || !canvasRef.current) return;
    let cancelled = false;
    let canvas = null;

    const onKey = (e) => {
      if (!canvas) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement.tagName !== 'INPUT') {
        const obj = canvas.getActiveObject();
        if (obj) { canvas.remove(obj); canvas.discardActiveObject(); canvas.renderAll(); }
      }
    };
    window.addEventListener('keydown', onKey);

    loadFabric().then((fabric) => {
      if (cancelled || !canvasRef.current || !fabric) return;

      canvas = new fabric.Canvas(canvasRef.current, {
        preserveObjectStacking: true,
        stopContextMenu: true,
        fireRightClick: false,
      });
      fabricRef.current = canvas;

      canvas.on('object:moving', (e) => handleSnap(e.target, canvas));
      canvas.on('object:moved', () => hideGuides());
      canvas.on('object:modified', (e) => { hideGuides(); syncControls(e.target); });
      canvas.on('selection:created', (e) => syncControls(e.selected?.[0]));
      canvas.on('selection:updated', (e) => syncControls(e.selected?.[0]));
      canvas.on('selection:cleared', () => { setHasSelection(false); setActiveScale(1); setActiveOpacity(1); setActiveAngle(0); });

      if (job.creatives?.length) loadImage(0, canvas);
    }).catch(() => {
      if (!cancelled) setError('Fabric.js failed to load. Check network.');
    });

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      if (canvas) canvas.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  const syncControls = (obj) => {
    if (!obj) return;
    setHasSelection(true);
    setActiveScale(+((obj.scaleX || 1).toFixed(3)));
    setActiveOpacity(+((obj.opacity ?? 1).toFixed(2)));
    setActiveAngle(Math.round(obj.angle || 0));
  };

  const loadImage = (idx, canvas) => {
    const creative = jobRef.current?.creatives?.[idx];
    if (!creative || !containerRef.current || !window.fabric) return;
    canvas.clear();

    window.fabric.Image.fromURL(
      creative.image_url,
      (img) => {
        const el = containerRef.current;
        const availW = Math.max(200, (el?.clientWidth || 800) - 48);
        const availH = Math.max(200, (el?.clientHeight || 600) - 48);
        const scale = Math.min(availW / img.width, availH / img.height);
        const dispW = Math.round(img.width * scale);
        const dispH = Math.round(img.height * scale);
        canvas.setWidth(dispW);
        canvas.setHeight(dispH);
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), { scaleX: scale, scaleY: scale });
        bgInfoRef.current = { img_w: img.width, img_h: img.height, scale };
        restoreLogos(creative.id, canvas, scale);
      },
      { crossOrigin: 'anonymous' }
    );
  };

  const restoreLogos = (creativeId, canvas, imgScale) => {
    const list = savedRef.current[creativeId] || [];
    list.forEach(ld => {
      const meta = logoMetaRef.current[ld.logo_id];
      if (!meta) return;
      const us = Math.min(
        (ld.logo_w * imgScale) / meta.trimmed_w,
        (ld.logo_h * imgScale) / meta.trimmed_h
      );
      const lx = ld.x * imgScale - meta.trim_left * us;
      const ly = ld.y * imgScale - meta.trim_top * us;
      window.fabric.Image.fromURL(meta.logo_url, (img) => {
        img.set({ left: lx, top: ly, scaleX: us, scaleY: us, angle: ld.angle_deg || 0, opacity: ld.opacity ?? 1 });
        img._logo_id = ld.logo_id;
        canvas.add(img);
        canvas.renderAll();
      }, { crossOrigin: 'anonymous' });
    });
  };

  const captureCurrent = () => {
    const canvas = fabricRef.current;
    if (!canvas || !bgInfoRef.current) return;
    const creative = jobRef.current?.creatives?.[currentIdxRef.current];
    if (!creative) return;
    const { scale } = bgInfoRef.current;
    const logos = [];
    canvas.getObjects().forEach(obj => {
      if (!obj._logo_id) return;
      const meta = logoMetaRef.current[obj._logo_id];
      if (!meta) return;
      const us = obj.scaleX;
      logos.push({
        logo_id: obj._logo_id,
        x: Math.round((obj.left + meta.trim_left * us) / scale),
        y: Math.round((obj.top + meta.trim_top * us) / scale),
        logo_w: Math.round((meta.trimmed_w * us) / scale),
        logo_h: Math.round((meta.trimmed_h * us) / scale),
        angle_deg: obj.angle || 0,
        opacity: obj.opacity ?? 1,
      });
    });
    savedRef.current = { ...savedRef.current, [creative.id]: logos };
  };

  const handleSwitchImage = (idx) => {
    if (idx === currentIdxRef.current || !fabricRef.current) return;
    captureCurrent();
    currentIdxRef.current = idx;
    setCurrentIdx(idx);
    loadImage(idx, fabricRef.current);
  };

  const hideGuides = () => {
    if (guideHRef.current) guideHRef.current.style.display = 'none';
    if (guideVRef.current) guideVRef.current.style.display = 'none';
  };

  const showGuide = (hY, vX) => {
    if (guideHRef.current) {
      if (hY !== null) { guideHRef.current.style.display = 'block'; guideHRef.current.style.top = hY + 'px'; }
      else guideHRef.current.style.display = 'none';
    }
    if (guideVRef.current) {
      if (vX !== null) { guideVRef.current.style.display = 'block'; guideVRef.current.style.left = vX + 'px'; }
      else guideVRef.current.style.display = 'none';
    }
  };

  const handleSnap = (obj, canvas) => {
    if (!obj) return;
    const cw = canvas.getWidth(), ch = canvas.getHeight();
    const ow = obj.getScaledWidth(), oh = obj.getScaledHeight();
    const cx = obj.left + ow / 2, cy = obj.top + oh / 2;
    let snapX = null, snapY = null;

    if (Math.abs(cx - cw / 2) < SNAP_PX) { obj.set({ left: cw / 2 - ow / 2 }); snapX = cw / 2; }
    if (Math.abs(cy - ch / 2) < SNAP_PX) { obj.set({ top: ch / 2 - oh / 2 }); snapY = ch / 2; }

    canvas.getObjects().forEach(other => {
      if (other === obj || !other._logo_id) return;
      const ow2 = other.getScaledWidth(), oh2 = other.getScaledHeight();
      const ocx = other.left + ow2 / 2, ocy = other.top + oh2 / 2;
      if (Math.abs(cy - ocy) < SNAP_PX) { obj.set({ top: ocy - oh / 2 }); snapY = ocy; }
      if (Math.abs(cx - ocx) < SNAP_PX) { obj.set({ left: ocx - ow / 2 }); snapX = ocx; }
      if (Math.abs(obj.top - other.top) < SNAP_PX) { obj.set({ top: other.top }); snapY = other.top; }
      if (Math.abs(obj.top + oh - other.top - oh2) < SNAP_PX) { obj.set({ top: other.top + oh2 - oh }); snapY = other.top + oh2; }
    });
    showGuide(snapY, snapX);
  };

  const handleAddLogo = async (logo) => {
    if (!fabricRef.current || !bgInfoRef.current) return;
    setPlacementsLoading(true);
    setError('');
    try {
      const data = await creativesApi.logoPlacementsForJob(jobId, logo.id);

      const firstP = data.placements[0];
      if (!firstP) throw new Error('No placement data returned');

      logoMetaRef.current[logo.id] = {
        logo_url: data.logo.file_url || data.logo.url,
        trim_left: firstP.trim_left,
        trim_top: firstP.trim_top,
        trimmed_w: firstP.trimmed_w,
        trimmed_h: firstP.trimmed_h,
      };

      data.placements.forEach(p => {
        const placement = { logo_id: logo.id, x: p.x, y: p.y, logo_w: p.logo_w, logo_h: p.logo_h, angle_deg: 0, opacity: 1 };
        const existing = savedRef.current[p.creative_id] || [];
        if (!existing.some(ld => ld.logo_id === logo.id)) {
          savedRef.current[p.creative_id] = [...existing, placement];
        }
        // Keep original OpenCV values separate so reset can always return to them
        const origExisting = originalPlacementsRef.current[p.creative_id] || [];
        if (!origExisting.some(ld => ld.logo_id === logo.id)) {
          originalPlacementsRef.current[p.creative_id] = [...origExisting, { ...placement }];
        }
      });

      const currentCreative = jobRef.current?.creatives?.[currentIdxRef.current];
      const p = data.placements.find(pl => pl.creative_id === currentCreative?.id) || data.placements[0];
      const { scale } = bgInfoRef.current;
      const meta = logoMetaRef.current[logo.id];
      const us = Math.min((p.logo_w * scale) / meta.trimmed_w, (p.logo_h * scale) / meta.trimmed_h);
      const lx = p.x * scale - meta.trim_left * us;
      const ly = p.y * scale - meta.trim_top * us;

      window.fabric.Image.fromURL(meta.logo_url, (img) => {
        img.set({ left: lx, top: ly, scaleX: us, scaleY: us, angle: 0, opacity: 1 });
        img._logo_id = logo.id;
        fabricRef.current.add(img);
        fabricRef.current.setActiveObject(img);
        fabricRef.current.renderAll();
        syncControls(img);
      }, { crossOrigin: 'anonymous' });
    } catch (e) {
      setError(e.message || 'Failed to load placement data');
    } finally {
      setPlacementsLoading(false);
    }
  };

  const handleApplyToAll = () => {
    captureCurrent();
    const currentCreativeId = jobRef.current?.creatives?.[currentIdxRef.current]?.id;
    const source = savedRef.current[currentCreativeId] || [];
    if (!source.length) return;
    const bgInfo = bgInfoRef.current;
    if (!bgInfo) return;

    jobRef.current?.creatives?.forEach(creative => {
      if (creative.id === currentCreativeId) return;
      savedRef.current[creative.id] = source.map(ld => ({
        ...ld,
        x: Math.round(ld.x * (creative.img_w || bgInfo.img_w) / bgInfo.img_w),
        y: Math.round(ld.y * (creative.img_h || bgInfo.img_h) / bgInfo.img_h),
      }));
    });
    setError('');
  };

  const handleScale = (val) => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj) return;
    obj.set({ scaleX: val, scaleY: val });
    fabricRef.current.renderAll();
    setActiveScale(val);
  };
  const handleOpacity = (val) => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj) return;
    obj.set({ opacity: val });
    fabricRef.current.renderAll();
    setActiveOpacity(val);
  };
  const handleAngle = (val) => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj) return;
    obj.set({ angle: val });
    fabricRef.current.renderAll();
    setActiveAngle(val);
  };
  const handleReset = () => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!obj || !bgInfoRef.current) return;

    const logoId = obj._logo_id;
    const meta = logoMetaRef.current[logoId];
    const creative = jobRef.current?.creatives?.[currentIdxRef.current];
    const placement = (originalPlacementsRef.current[creative?.id] || []).find(ld => ld.logo_id === logoId);

    if (meta && placement) {
      const { scale } = bgInfoRef.current;
      const us = Math.min((placement.logo_w * scale) / meta.trimmed_w, (placement.logo_h * scale) / meta.trimmed_h);
      const lx = placement.x * scale - meta.trim_left * us;
      const ly = placement.y * scale - meta.trim_top * us;
      obj.set({ left: lx, top: ly, scaleX: us, scaleY: us, opacity: 1, angle: 0 });
      setActiveScale(+us.toFixed(3));
    } else {
      obj.set({ opacity: 1, angle: 0 });
      setActiveScale(+(obj.scaleX.toFixed(3)));
    }
    canvas.renderAll();
    setActiveOpacity(1);
    setActiveAngle(0);
  };

  const handleDelete = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj) { canvas.remove(obj); canvas.discardActiveObject(); canvas.renderAll(); setHasSelection(false); }
  };

  const handleSave = async () => {
    captureCurrent();
    const placements = Object.entries(savedRef.current)
      .filter(([, logos]) => logos.length > 0)
      .map(([creative_id, logos]) => ({ creative_id, logos }));

    if (!placements.length) { setError('No logos placed on any image.'); return; }
    setSaving(true);
    setError('');
    try {
      const result = await creativesApi.logoEditorSave(jobId, placements);
      setSavedImages(result.images);
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Results view ──
  if (savedImages) {
    return (
      <div className="min-h-screen bg-[#05070a] text-white">
        <div className="max-w-4xl mx-auto py-10 px-6 space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard/gallery')}
              className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Logo Applied</h1>
              <p className="text-xs text-gray-500 mt-0.5">{savedImages.length} image{savedImages.length !== 1 ? 's' : ''} composited and saved</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {savedImages.map(img => (
              <a key={img.id} href={img.url} target="_blank" rel="noreferrer"
                className="rounded-xl overflow-hidden border border-white/10 hover:border-blue-500/30 transition-all group block">
                <img src={img.url} className="w-full h-auto object-cover group-hover:opacity-90 transition-opacity" alt="Composited" />
              </a>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/dashboard/gallery')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all text-sm">
              Back to Creatives
            </button>
            <button onClick={() => setSavedImages(null)}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold transition-all text-sm">
              Edit Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05070a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
      </div>
    );
  }

  if (!job) return (
    <div className="min-h-screen bg-[#05070a] flex items-center justify-center text-gray-500">
      Job not found.
    </div>
  );

  const creatives = job.creatives || [];

  return (
    <div className="flex flex-col bg-[#05070a] text-white" style={{ height: '100vh' }}>

      {/* ── Header ── */}
      <div className="shrink-0 px-5 py-3 border-b border-white/5 flex items-center justify-between bg-[#0a0d14]">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard/gallery')}
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white uppercase tracking-wider">Logo Editor</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">
              Job #{jobId} · {creatives.length} image{creatives.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="text-xs text-red-400 max-w-xs truncate">{error}</span>
            </div>
          )}
          {creatives.length > 1 && (
            <button onClick={handleApplyToAll}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all">
              <Copy className="w-3.5 h-3.5" /> Apply to All
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : 'Save & Export'}
          </button>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Brand logos ── */}
        <div className="w-48 shrink-0 border-r border-white/5 bg-[#0a0d14] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Brand Logos</p>
            <p className="text-[9px] text-gray-600 mt-0.5">Click to place on canvas</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {brandLogos.length === 0 ? (
              <p className="text-[10px] text-gray-600 text-center py-8 leading-relaxed">
                No logos uploaded.<br />Add them in Brand Kit.
              </p>
            ) : brandLogos.map(logo => (
              <button key={logo.id} onClick={() => handleAddLogo(logo)} disabled={placementsLoading}
                className="w-full flex items-center gap-2 p-2 bg-black/40 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/30 rounded-xl transition-all group disabled:opacity-40 text-left">
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden shrink-0 border border-white/5">
                  {logo.file_url
                    ? <img src={logo.file_url} className="w-full h-full object-contain p-0.5" alt={logo.name} />
                    : <div className="w-4 h-4 rounded bg-white/10" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-gray-300 truncate group-hover:text-white">{logo.name}</p>
                  {logo.is_primary && <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Primary</p>}
                </div>
              </button>
            ))}
          </div>
          {placementsLoading && (
            <div className="px-4 py-3 border-t border-white/5 flex items-center gap-2">
              <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
              <span className="text-[9px] text-blue-400 uppercase tracking-wider">Analyzing…</span>
            </div>
          )}
        </div>

        {/* ── Center: Canvas ── */}
        <div className="flex-1 flex flex-col bg-[#060810] overflow-hidden">
          <div ref={containerRef} className="flex-1 overflow-hidden flex items-center justify-center p-4">
            <div ref={wrapRef} className="relative shadow-2xl shrink-0">
              <div ref={guideHRef} style={{ display: 'none', position: 'absolute', left: 0, right: 0, height: 1, background: 'rgba(59,130,246,0.85)', pointerEvents: 'none', zIndex: 10 }} />
              <div ref={guideVRef} style={{ display: 'none', position: 'absolute', top: 0, bottom: 0, width: 1, background: 'rgba(59,130,246,0.85)', pointerEvents: 'none', zIndex: 10 }} />
              <canvas ref={canvasRef} />
            </div>
          </div>

          {creatives.length > 1 && (
            <div className="shrink-0 h-18 border-t border-white/5 bg-[#0a0d14] flex items-center gap-2.5 px-4 overflow-x-auto">
              {creatives.map((c, i) => (
                <button key={c.id} onClick={() => handleSwitchImage(i)}
                  className={`shrink-0 h-12 w-12 rounded-lg overflow-hidden border-2 transition-all ${
                    i === currentIdx ? 'border-blue-500 shadow-accent-glow' : 'border-white/10 hover:border-white/30'
                  }`}>
                  <img src={c.image_url} className="w-full h-full object-cover" alt={`Image ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Controls ── */}
        <div className="w-52 shrink-0 border-l border-white/5 bg-[#0a0d14] flex flex-col">
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Controls</p>
          </div>
          <div className="flex-1 p-4 space-y-5">
            <div className={`space-y-2 transition-opacity ${hasSelection ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <div className="flex justify-between">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Size</label>
                <span className="text-[10px] text-gray-400 font-mono">{Math.round(activeScale * 100)}%</span>
              </div>
              <input type="range" min="0.05" max="3" step="0.01" value={activeScale}
                onChange={(e) => handleScale(parseFloat(e.target.value))}
                className="w-full accent-blue-500 h-1.5 rounded-full cursor-pointer" />
            </div>

            <div className={`space-y-2 transition-opacity ${hasSelection ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <div className="flex justify-between">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Opacity</label>
                <span className="text-[10px] text-gray-400 font-mono">{Math.round(activeOpacity * 100)}%</span>
              </div>
              <input type="range" min="0.05" max="1" step="0.01" value={activeOpacity}
                onChange={(e) => handleOpacity(parseFloat(e.target.value))}
                className="w-full accent-blue-500 h-1.5 rounded-full cursor-pointer" />
            </div>

            <div className={`space-y-2 transition-opacity ${hasSelection ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <div className="flex justify-between">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Angle</label>
                <span className="text-[10px] text-gray-400 font-mono">{activeAngle}°</span>
              </div>
              <input type="range" min="-180" max="180" step="1" value={activeAngle}
                onChange={(e) => handleAngle(parseInt(e.target.value))}
                className="w-full accent-blue-500 h-1.5 rounded-full cursor-pointer" />
            </div>

            <button onClick={handleReset} disabled={!hasSelection}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 text-gray-300 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>

            <button onClick={handleDelete} disabled={!hasSelection}
              className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-30 border border-red-500/20 text-red-400 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2">
              <Trash2 className="w-3.5 h-3.5" /> Remove Logo
            </button>
          </div>
          <div className="p-4 border-t border-white/5">
            <p className="text-[9px] text-gray-600 leading-relaxed">
              Click a logo from the left panel to add it. Drag to reposition. Blue guides appear when snapping to center or other logos.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
