import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Save, Download, Check, Undo2, Redo2, RotateCcw, Trash2, Copy, AlertCircle, AlertTriangle, Loader2,
  Image as ImageIcon, Type, Crop, Layers, Upload, Plus, ChevronUp, ChevronDown,
  FlipHorizontal, FlipVertical, Wand2, Sparkles, Maximize, Eraser,
  AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react';
import { creativesApi, brandKitApi } from '../../lib/api';
import { loadFabric } from '../../lib/loadFabric';

const TEXT_COLORS = ['#FFFFFF', '#000000', '#2563EB', '#EF4444', '#F59E0B', '#10B981', '#A855F7'];

const FONTS = [
  'Montserrat', 'Oswald', 'Raleway', 'Poppins', 'Bebas Neue',
  'Anton', 'Playfair Display', 'Lora', 'Roboto', 'Open Sans',
  'Lato', 'Nunito', 'Arial', 'Georgia', 'Impact', 'Verdana',
];

const loadGoogleFonts = () => {
  if (document.getElementById('troxa-gfonts')) return;
  const link = document.createElement('link');
  link.id = 'troxa-gfonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&family=Oswald:wght@400;700&family=Raleway:wght@400;700;900&family=Poppins:wght@400;700;900&family=Bebas+Neue&family=Anton&family=Playfair+Display:wght@400;700&family=Lora:wght@400;700&family=Roboto:wght@400;700;900&family=Open+Sans:wght@400;700&family=Lato:wght@400;700;900&family=Nunito:wght@400;700;900&display=swap';
  document.head.appendChild(link);
};

// Same catalogue as the Generate Creatives page, plus "Current Size" as the
// default — the AI edit can either keep the canvas as-is or output one or
// more of the standard ad formats.
const AI_RATIO_OPTIONS = ['Current Size', '1:1 — Square', '4:5 — Portrait', '9:16 — Story', '16:9 — Landscape'];

function AiAspectRatioPicker({ ratios, onChange }) {
  const canAdd = ratios.length < AI_RATIO_OPTIONS.length;

  const addRatio = () => {
    const next = AI_RATIO_OPTIONS.find(r => !ratios.includes(r)) || AI_RATIO_OPTIONS[0];
    onChange([...ratios, next]);
  };
  const removeRatio = (i) => onChange(ratios.filter((_, idx) => idx !== i));
  const updateRatio = (i, val) => onChange(ratios.map((r, idx) => idx === i ? val : r));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[9px] text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
          <Maximize className="w-3 h-3" /> Aspect Ratio
        </label>
        {canAdd && (
          <button type="button" onClick={addRatio}
            className="text-[10px] font-black text-(--accent) hover:text-(--accent-hover) flex items-center gap-1 transition-colors uppercase tracking-wider">
            <Plus className="w-3 h-3" /> Add more
          </button>
        )}
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {ratios.map((r, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: i > 0 ? 8 : 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.18 }}
              className="flex gap-2">
              <div className="relative flex-1">
                <select value={r} onChange={(e) => updateRatio(i, e.target.value)}
                  className="w-full bg-black border border-white/5 hover:border-white/12 focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] rounded-xl py-2.5 px-3 text-xs text-white outline-none appearance-none cursor-pointer transition-all">
                  {AI_RATIO_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
              </div>
              {ratios.length > 1 && (
                <button type="button" onClick={() => removeRatio(i)}
                  className="w-9 h-9 rounded-xl bg-white/4 border border-white/6 hover:bg-red-500/10 hover:border-red-500/20 text-slate-600 hover:text-red-400 flex items-center justify-center transition-all shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {ratios.length > 1 && (
        <p className="text-[10px] text-gray-600">{ratios.length} formats will be generated</p>
      )}
    </div>
  );
}

// ── In-place editor pane ───────────────────────────────────────────────────
// Rendered as the *same* grid card element that was clicked (parent keeps
// the React key stable), so Framer Motion's `layout` animation grows the
// card from its thumbnail box into this full editor in place — no modal,
// no backdrop, nothing feels like a navigation. This component only owns
// the content; the parent owns the growing box + glass chrome.
export default function CreativeEditorPane({ creativeId, onClose, onSaved }) {
  // ── Data state ──
  const [creative, setCreative] = useState(null);
  const [otherCreatives, setOtherCreatives] = useState([]);
  const [brandLogos, setBrandLogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── UI state ──
  const [activePanel, setActivePanel] = useState('ai'); // ai | logos | images | text | crop | layers
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiRatios, setAiRatios] = useState(['Current Size']);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResults, setAiResults] = useState([]); // [{id, image_url, description, ratio}]
  const [currentSourceUrl, setCurrentSourceUrl] = useState(null);
  const [eraseBrushSize, setEraseBrushSize] = useState(40);
  const [erasing, setErasing] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [selectedType, setSelectedType] = useState(null); // 'image' | 'textbox'
  const [activeScale, setActiveScale] = useState(1);
  const [activeOpacity, setActiveOpacity] = useState(1);
  const [activeAngle, setActiveAngle] = useState(0);
  const [activeFontSize, setActiveFontSize] = useState(32);
  const [activeColor, setActiveColor] = useState('#FFFFFF');
  const [activeFontFamily, setActiveFontFamily] = useState('Arial');
  const [activeFontWeight, setActiveFontWeight] = useState('900');
  const [activeTextAlign, setActiveTextAlign] = useState('center');
  const [activeTextContent, setActiveTextContent] = useState('');
  const [isCropping, setIsCropping] = useState(false);
  const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 });
  const [canvasReady, setCanvasReady] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [, setLayersTick] = useState(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // ── Refs ──
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const containerRef = useRef(null);
  const bgInfoRef = useRef(null); // { naturalW, naturalH }
  const cropRectRef = useRef(null);
  const guideHRef = useRef(null);
  const guideVRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const maskDrawingRef = useRef(false);
  const historyRef = useRef([]); // [{ json, w, h }]
  const historyIndexRef = useRef(-1);
  // The history index at the moment of the last successful "Save to
  // Gallery" (or the initial load) — anything past this point is an
  // unsaved change, which is what the leave-without-saving prompt checks.
  const savedHistoryIndexRef = useRef(-1);
  const isRestoringRef = useRef(false);
  const fileInputRef = useRef(null);

  const creativeProxyUrl = (cid) => {
    const token = localStorage.getItem('access_token');
    const wsId = localStorage.getItem('active_workspace_id');
    return `/api/creatives/${cid}/image/?token=${token}&workspace_id=${wsId}`;
  };

  const isDirty = () => historyIndexRef.current !== savedHistoryIndexRef.current;

  const requestClose = () => {
    if (isDirty()) setShowLeaveConfirm(true);
    else onClose();
  };

  // ── Close on Escape ──
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  useEffect(() => {
    const mc = maskCanvasRef.current;
    if (!mc) return;
    const ctx = mc.getContext('2d');
    ctx.clearRect(0, 0, mc.width, mc.height);
    setHasMask(false);
  }, [canvasDims]);

  // ── Load data ──
  useEffect(() => {
    // Fetch the target creative directly by id — the gallery list is
    // paginated (most-recent-first), so searching for it there would fail
    // to find (and error out on) any creative beyond the first page.
    Promise.all([
      creativesApi.getCreative(creativeId),
      creativesApi.gallery({ media_type: 'Photo', page_size: 60 }),
      brandKitApi.getLogos(),
    ]).then(([found, items, logos]) => {
      setCreative(found || null);
      const list = items?.results || items || [];
      setOtherCreatives(list.filter(c => String(c.id) !== String(creativeId)));
      setBrandLogos(Array.isArray(logos) ? logos : (logos?.results || []));
      if (!found) setError('Creative not found.');
    }).catch(e => setError(e.message || 'Failed to load creative.')).finally(() => setLoading(false));
  }, [creativeId]);

  const bumpLayers = () => setLayersTick(t => t + 1);

  const SNAP_PX = 14;

  const hideGuides = () => {
    if (guideHRef.current) guideHRef.current.style.display = 'none';
    if (guideVRef.current) guideVRef.current.style.display = 'none';
  };

  const handleSnap = (obj, canvas) => {
    if (!obj) return;
    const cw = canvas.getWidth(), ch = canvas.getHeight();
    const ow = obj.getScaledWidth(), oh = obj.getScaledHeight();
    // getCenterPoint() returns true center regardless of originX/originY
    const cp = obj.getCenterPoint();
    let cx = cp.x, cy = cp.y;
    let snapX = null, snapY = null;

    const move = (nx, ny) => {
      cx = nx ?? cx; cy = ny ?? cy;
      obj.setPositionByOrigin(new window.fabric.Point(cx, cy), 'center', 'center');
    };

    // Center of canvas
    if (Math.abs(cx - cw / 2) < SNAP_PX) { move(cw / 2, null); snapX = cw / 2; }
    if (Math.abs(cy - ch / 2) < SNAP_PX) { move(null, ch / 2); snapY = ch / 2; }

    // Edges of canvas
    if (Math.abs(cx - ow / 2) < SNAP_PX) { move(ow / 2, null); snapX = 0; }
    if (Math.abs(cy - oh / 2) < SNAP_PX) { move(null, oh / 2); snapY = 0; }
    if (Math.abs(cx + ow / 2 - cw) < SNAP_PX) { move(cw - ow / 2, null); snapX = cw; }
    if (Math.abs(cy + oh / 2 - ch) < SNAP_PX) { move(null, ch - oh / 2); snapY = ch; }

    // Other canvas objects
    canvas.getObjects().forEach(other => {
      if (other === obj || other._isCropRect) return;
      const ow2 = other.getScaledWidth(), oh2 = other.getScaledHeight();
      const ocp = other.getCenterPoint();
      const ocx = ocp.x, ocy = ocp.y;
      // Center-to-center
      if (Math.abs(cy - ocy) < SNAP_PX) { move(null, ocy); snapY = ocy; }
      if (Math.abs(cx - ocx) < SNAP_PX) { move(ocx, null); snapX = ocx; }
      // Top-edge alignment
      if (Math.abs((cy - oh / 2) - (ocy - oh2 / 2)) < SNAP_PX) { move(null, ocy - oh2 / 2 + oh / 2); snapY = ocy - oh2 / 2; }
      // Bottom-edge alignment
      if (Math.abs((cy + oh / 2) - (ocy + oh2 / 2)) < SNAP_PX) { move(null, ocy + oh2 / 2 - oh / 2); snapY = ocy + oh2 / 2; }
    });

    if (guideHRef.current) {
      if (snapY !== null) { guideHRef.current.style.display = 'block'; guideHRef.current.style.top = snapY + 'px'; }
      else guideHRef.current.style.display = 'none';
    }
    if (guideVRef.current) {
      if (snapX !== null) { guideVRef.current.style.display = 'block'; guideVRef.current.style.left = snapX + 'px'; }
      else guideVRef.current.style.display = 'none';
    }
    canvas.renderAll();
  };

  const pushHistory = useCallback(() => {
    if (isRestoringRef.current) return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    const json = JSON.stringify(canvas.toJSON(['_layerType', '_layerName']));
    const entry = { json, w: canvas.getWidth(), h: canvas.getHeight() };
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(entry);
    historyIndexRef.current = historyRef.current.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const restoreFromHistory = useCallback(() => {
    const canvas = fabricRef.current;
    const entry = historyRef.current[historyIndexRef.current];
    if (!canvas || !entry) return;
    isRestoringRef.current = true;
    canvas.setWidth(entry.w);
    canvas.setHeight(entry.h);
    canvas.loadFromJSON(entry.json, () => {
      canvas.renderAll();
      setCanvasDims({ w: canvas.getWidth(), h: canvas.getHeight() });
      if (canvas.backgroundImage) {
        bgInfoRef.current = { naturalW: canvas.backgroundImage.width, naturalH: canvas.backgroundImage.height };
      }
      isRestoringRef.current = false;
      bumpLayers();
      setHasSelection(false);
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    });
  }, []);

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    restoreFromHistory();
  };
  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    restoreFromHistory();
  };

  const syncControls = (obj) => {
    if (!obj || obj._isCropRect) { setHasSelection(false); return; }
    setHasSelection(true);
    setSelectedType(obj.type === 'textbox' ? 'textbox' : 'image');
    setActiveScale(+((obj.scaleX || 1).toFixed(3)));
    setActiveOpacity(+((obj.opacity ?? 1).toFixed(2)));
    setActiveAngle(Math.round(obj.angle || 0));
    if (obj.type === 'textbox') {
      setActiveFontSize(obj.fontSize || 32);
      setActiveColor(obj.fill || '#FFFFFF');
      setActiveFontFamily(obj.fontFamily || 'Arial');
      setActiveFontWeight(String(obj.fontWeight || '900'));
      setActiveTextAlign(obj.textAlign || 'center');
      setActiveTextContent(obj.text || '');
    }
  };

  const resetControls = () => {
    setHasSelection(false);
    setSelectedType(null);
    setActiveScale(1);
    setActiveOpacity(1);
    setActiveAngle(0);
  };

  // ── Load background image into a fresh Fabric canvas ──
  const loadCreativeImage = useCallback(() => {
    const canvas = fabricRef.current;
    const { fabric } = window;
    if (!canvas || !fabric || !creative) return;
    canvas.clear();

    fabric.Image.fromURL(creativeProxyUrl(creative.id), (img) => {
      const el = containerRef.current;
      const availW = Math.max(200, (el?.clientWidth || 800) - 64);
      const availH = Math.max(200, (el?.clientHeight || 600) - 64);
      const scale = Math.min(availW / img.width, availH / img.height, 1);
      const dispW = Math.round(img.width * scale);
      const dispH = Math.round(img.height * scale);
      canvas.setWidth(dispW);
      canvas.setHeight(dispH);
      canvas.setBackgroundImage(img, () => {
        canvas.renderAll();
        setCanvasDims({ w: dispW, h: dispH });
        setCanvasReady(true);
        bgInfoRef.current = { naturalW: img.width, naturalH: img.height };
        historyRef.current = [];
        historyIndexRef.current = -1;
        pushHistory();
        savedHistoryIndexRef.current = historyIndexRef.current;
      }, { scaleX: scale, scaleY: scale });
    }, { crossOrigin: 'anonymous' });
  }, [creative, pushHistory]);

  // ── Init Fabric canvas once (Fabric.js itself loads on demand — see loadFabric) ──
  useEffect(() => {
    if (!creative || !canvasRef.current) return;
    let cancelled = false;
    let canvas = null;

    const onKey = (e) => {
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (active?.isEditing) return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (active && !active._isCropRect) { canvas.remove(active); canvas.discardActiveObject(); canvas.renderAll(); }
      }
      const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (active && !active._isCropRect && ARROWS[e.key]) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = ARROWS[e.key];
        active.set({ left: active.left + dx * step, top: active.top + dy * step });
        active.setCoords();
        canvas.renderAll();
        pushHistory();
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

      canvas.on('object:added', (e) => { if (!e.target?._isCropRect) bumpLayers(); });
      canvas.on('object:removed', () => bumpLayers());
      canvas.on('object:moving', (e) => handleSnap(e.target, canvas));
      canvas.on('object:moved', () => hideGuides());
      canvas.on('object:modified', (e) => { hideGuides(); syncControls(e.target); pushHistory(); });
      canvas.on('selection:created', (e) => syncControls(e.selected?.[0]));
      canvas.on('selection:updated', (e) => syncControls(e.selected?.[0]));
      canvas.on('selection:cleared', resetControls);
      canvas.on('text:changed', (e) => { if (e.target?.type === 'textbox') setActiveTextContent(e.target.text || ''); });
      canvas.on('text:editing:exited', () => pushHistory());
      loadGoogleFonts();

      loadCreativeImage();
    }).catch(() => {
      if (!cancelled) setError('Fabric.js failed to load. Check your connection.');
    });

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      if (canvas) { canvas.dispose(); fabricRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creative]);

  // ── Add Logo (OpenCV placement) ──
  const [logoPlacementLoading, setLogoPlacementLoading] = useState(false);

  const handleAddLogo = async (logo) => {
    const canvas = fabricRef.current;
    const { fabric } = window;
    if (!canvas || !fabric || !creative) return;
    setLogoPlacementLoading(true);
    try {
      const p = await creativesApi.logoPlacement(creative.id, logo.id);
      const { scale } = bgInfoRef.current || {};
      const displayScale = scale || Math.min(canvas.getWidth() / (p.img_w || 1024), canvas.getHeight() / (p.img_h || 1024));
      const us = Math.min(
        (p.logo_w * displayScale) / p.trimmed_w,
        (p.logo_h * displayScale) / p.trimmed_h,
      );
      const lx = p.x * displayScale - p.trim_left * us;
      const ly = p.y * displayScale - p.trim_top * us;
      fabric.Image.fromURL(p.logo_url, (img) => {
        img.set({ left: lx, top: ly, scaleX: us, scaleY: us });
        img._layerType = 'logo';
        img._layerName = logo.name || 'Logo';
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        syncControls(img);
        pushHistory();
      }, { crossOrigin: 'anonymous' });
    } catch {
      // fallback: center placement
      fabric.Image.fromURL(logo.file_url, (img) => {
        const maxDim = Math.min(canvas.getWidth(), canvas.getHeight()) * 0.32;
        const s = Math.min(1, maxDim / Math.max(img.width, img.height));
        img.set({ left: canvas.getWidth() / 2 - (img.width * s) / 2, top: canvas.getHeight() / 2 - (img.height * s) / 2, scaleX: s, scaleY: s });
        img._layerType = 'logo';
        img._layerName = logo.name || 'Logo';
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        syncControls(img);
        pushHistory();
      }, { crossOrigin: 'anonymous' });
    } finally {
      setLogoPlacementLoading(false);
    }
  };

  // ── Add Image from device ──
  const handleUploadImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const canvas = fabricRef.current;
      const { fabric } = window;
      if (!canvas || !fabric) return;
      fabric.Image.fromURL(ev.target.result, (img) => {
        const maxDim = Math.min(canvas.getWidth(), canvas.getHeight()) * 0.55;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        img.set({
          left: canvas.getWidth() / 2, top: canvas.getHeight() / 2,
          scaleX: scale, scaleY: scale, originX: 'center', originY: 'center',
        });
        img._layerType = 'image';
        img._layerName = file.name;
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        syncControls(img);
        pushHistory();
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Add another creative as an overlay image ──
  const handleAddCreativeImage = (other) => {
    const canvas = fabricRef.current;
    const { fabric } = window;
    if (!canvas || !fabric) return;
    fabric.Image.fromURL(creativeProxyUrl(other.id), (img) => {
      const maxDim = Math.min(canvas.getWidth(), canvas.getHeight()) * 0.55;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      img.set({
        left: canvas.getWidth() / 2, top: canvas.getHeight() / 2,
        scaleX: scale, scaleY: scale, originX: 'center', originY: 'center',
      });
      img._layerType = 'image';
      img._layerName = other.name || 'Creative';
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      syncControls(img);
      pushHistory();
    }, { crossOrigin: 'anonymous' });
  };

  // ── Add Text ──
  const handleAddText = () => {
    const canvas = fabricRef.current;
    const { fabric } = window;
    if (!canvas || !fabric) return;
    const text = new fabric.Textbox('Your text here', {
      left: canvas.getWidth() / 2, top: canvas.getHeight() / 2,
      originX: 'center', originY: 'center',
      fontSize: 32, fill: '#FFFFFF', fontWeight: '900', fontFamily: 'Arial',
      textAlign: 'center', width: canvas.getWidth() * 0.7,
    });
    text._layerType = 'text';
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    syncControls(text);
    pushHistory();
  };

  // ── Selection property handlers ──
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
  const handleFontSize = (val) => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj || obj.type !== 'textbox') return;
    obj.set({ fontSize: val });
    obj.initDimensions();
    fabricRef.current.renderAll();
    setActiveFontSize(val);
  };
  const handleTextColor = (color) => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj || obj.type !== 'textbox') return;
    obj.set({ fill: color });
    fabricRef.current.renderAll();
    setActiveColor(color);
  };
  const handleFontFamily = (family) => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj || obj.type !== 'textbox') return;
    obj.set({ fontFamily: family });
    obj.initDimensions();
    fabricRef.current.renderAll();
    setActiveFontFamily(family);
  };
  const handleFontWeight = (weight) => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj || obj.type !== 'textbox') return;
    obj.set({ fontWeight: weight });
    obj.initDimensions();
    fabricRef.current.renderAll();
    setActiveFontWeight(weight);
  };
  const handleTextAlign = (align) => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj || obj.type !== 'textbox') return;
    obj.set({ textAlign: align });
    obj.initDimensions();
    fabricRef.current.renderAll();
    setActiveTextAlign(align);
  };
  const handleTextContent = (content) => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj || obj.type !== 'textbox' || obj.isEditing) return;
    obj.set({ text: content });
    obj.initDimensions();
    fabricRef.current.renderAll();
    setActiveTextContent(content);
  };
  const handleFlip = (axis) => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj) return;
    obj.set(axis === 'x' ? { flipX: !obj.flipX } : { flipY: !obj.flipY });
    fabricRef.current.renderAll();
  };
  const commitChange = () => pushHistory();

  const handleDuplicate = () => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    obj.clone((cloned) => {
      cloned.set({ left: obj.left + 24, top: obj.top + 24 });
      cloned._layerType = obj._layerType;
      cloned._layerName = obj._layerName;
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
      syncControls(cloned);
      pushHistory();
    });
  };
  const handleDelete = () => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.renderAll();
    resetControls();
    pushHistory();
  };
  const handleBringForward = () => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    canvas.bringForward(obj);
    canvas.renderAll();
    bumpLayers();
    pushHistory();
  };
  const handleSendBackward = () => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    canvas.sendBackwards(obj);
    canvas.renderAll();
    bumpLayers();
    pushHistory();
  };

  const selectLayer = (obj) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setActiveObject(obj);
    canvas.renderAll();
    syncControls(obj);
  };
  const deleteLayer = (obj) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.renderAll();
    resetControls();
    pushHistory();
  };

  // ── Crop ──
  const startCrop = () => {
    const canvas = fabricRef.current;
    const { fabric } = window;
    if (!canvas || !fabric) return;
    canvas.discardActiveObject();
    const w = canvas.getWidth(), h = canvas.getHeight();
    const rw = w * 0.7, rh = h * 0.7;
    const rect = new fabric.Rect({
      left: (w - rw) / 2, top: (h - rh) / 2, width: rw, height: rh,
      fill: 'rgba(168,85,247,0.08)', stroke: '#a855f7', strokeWidth: 1.5, strokeDashArray: [6, 4],
      cornerColor: '#a855f7', cornerStyle: 'circle', transparentCorners: false,
      lockRotation: true, hasRotatingPoint: false,
    });
    rect._isCropRect = true;
    rect.setControlsVisibility({ mtr: false });
    canvas.getObjects().forEach(o => { o.__prevSelectable = o.selectable; o.selectable = false; o.evented = false; });
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
    cropRectRef.current = rect;
    setIsCropping(true);
  };

  const restoreSelectability = () => {
    fabricRef.current?.getObjects().forEach(o => {
      if (o._isCropRect) return;
      o.selectable = o.__prevSelectable ?? true;
      o.evented = true;
    });
  };

  const cancelCrop = () => {
    const canvas = fabricRef.current;
    if (canvas && cropRectRef.current) canvas.remove(cropRectRef.current);
    restoreSelectability();
    cropRectRef.current = null;
    setIsCropping(false);
    canvas?.renderAll();
  };

  const applyCrop = () => {
    const canvas = fabricRef.current;
    const { fabric } = window;
    const rect = cropRectRef.current;
    if (!canvas || !fabric || !rect) return;

    const left = Math.max(0, Math.round(rect.left));
    const top = Math.max(0, Math.round(rect.top));
    const width = Math.min(canvas.getWidth() - left, Math.round(rect.getScaledWidth()));
    const height = Math.min(canvas.getHeight() - top, Math.round(rect.getScaledHeight()));
    if (width < 10 || height < 10) { cancelCrop(); return; }

    canvas.remove(rect);
    canvas.discardActiveObject();
    canvas.renderAll();

    let dataUrl;
    try {
      dataUrl = canvas.toDataURL({ format: 'png', left, top, width, height });
    } catch {
      setError('Crop failed — one of the layers is hosted externally without CORS access.');
      restoreSelectability();
      cropRectRef.current = null;
      setIsCropping(false);
      return;
    }

    restoreSelectability();
    canvas.clear();
    canvas.setWidth(width);
    canvas.setHeight(height);

    fabric.Image.fromURL(dataUrl, (img) => {
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
      bgInfoRef.current = { naturalW: width, naturalH: height };
      setCanvasDims({ w: width, h: height });
      cropRectRef.current = null;
      setIsCropping(false);
      resetControls();
      pushHistory();
    });
  };

  const handleResetAll = () => {
    historyRef.current = [];
    historyIndexRef.current = -1;
    resetControls();
    if (isCropping) cancelCrop();
    setCurrentSourceUrl(null);
    const mc = maskCanvasRef.current;
    if (mc) { mc.getContext('2d').clearRect(0, 0, mc.width, mc.height); setHasMask(false); }
    loadCreativeImage();
  };

  const applyAiResult = (url) => {
    const canvas = fabricRef.current;
    const { fabric } = window;
    if (!canvas || !fabric) return;
    fabric.Image.fromURL(url, (img) => {
      const el = containerRef.current;
      const availW = Math.max(200, (el?.clientWidth || 800) - 64);
      const availH = Math.max(200, (el?.clientHeight || 600) - 64);
      const scale = Math.min(availW / img.width, availH / img.height, 1);
      const dispW = Math.round(img.width * scale);
      const dispH = Math.round(img.height * scale);
      canvas.setWidth(dispW);
      canvas.setHeight(dispH);
      canvas.setBackgroundImage(img, () => {
        canvas.renderAll();
        setCanvasDims({ w: dispW, h: dispH });
        bgInfoRef.current = { naturalW: img.width, naturalH: img.height };
        pushHistory();
      }, { scaleX: scale, scaleY: scale });
    }, { crossOrigin: 'anonymous' });
  };

  const getMaskDataUrl = () => {
    const display = maskCanvasRef.current;
    if (!display) return null;
    const ctx = display.getContext('2d');
    const imgData = ctx.getImageData(0, 0, display.width, display.height);
    const offscreen = document.createElement('canvas');
    offscreen.width = display.width;
    offscreen.height = display.height;
    const offCtx = offscreen.getContext('2d');
    offCtx.fillStyle = 'black';
    offCtx.fillRect(0, 0, display.width, display.height);
    const outData = offCtx.createImageData(display.width, display.height);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const val = imgData.data[i + 3] > 5 ? 255 : 0;
      outData.data[i] = val; outData.data[i+1] = val; outData.data[i+2] = val; outData.data[i+3] = 255;
    }
    offCtx.putImageData(outData, 0, 0);
    const { naturalW, naturalH } = bgInfoRef.current || {};
    if (!naturalW || !naturalH) return offscreen.toDataURL('image/png');
    const final = document.createElement('canvas');
    final.width = naturalW; final.height = naturalH;
    final.getContext('2d').drawImage(offscreen, 0, 0, naturalW, naturalH);
    return final.toDataURL('image/png');
  };

  const clearMask = () => {
    const mc = maskCanvasRef.current;
    if (!mc) return;
    mc.getContext('2d').clearRect(0, 0, mc.width, mc.height);
    setHasMask(false);
  };

  const onMaskPointerDown = (e) => {
    maskDrawingRef.current = true;
    drawMaskStroke(e);
  };
  const onMaskPointerMove = (e) => {
    if (!maskDrawingRef.current) return;
    drawMaskStroke(e);
  };
  const onMaskPointerUp = () => { maskDrawingRef.current = false; };

  const drawMaskStroke = (e) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * sx;
    const y = (e.clientY - rect.top) * sy;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(239, 68, 68, 1)';
    ctx.beginPath();
    ctx.arc(x, y, (eraseBrushSize / 2) * sx, 0, Math.PI * 2);
    ctx.fill();
    setHasMask(true);
  };

  const handleEraseApply = async () => {
    if (!hasMask || erasing) return;
    const maskData = getMaskDataUrl();
    if (!maskData) return;
    setErasing(true);
    const srcUrl = currentSourceUrl || creative?.image_url;
    try {
      const result = await creativesApi.eraseCreative(creative.id, {
        source_image_url: srcUrl,
        mask_data: maskData,
      });
      clearMask();
      setCurrentSourceUrl(result.image_url);
      applyAiResult(result.image_url);
    } catch (e) {
      setError(e?.detail || e?.message || 'Erase failed.');
    } finally {
      setErasing(false);
    }
  };

  const handleAiEdit = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError('');
    setAiResults([]);
    const srcUrl = currentSourceUrl || creative?.image_url;
    try {
      const calls = aiRatios.map(ratio =>
        creativesApi.aiEdit(creative.id, { prompt: aiPrompt, aspect_ratio: ratio, source_image_url: srcUrl })
          .then(r => ({ ...r, ratio }))
          .catch(e => ({ error: e?.detail || e?.message || 'Failed', ratio }))
      );
      const results = await Promise.all(calls);
      const succeeded = results.filter(r => r.image_url);
      if (!succeeded.length) {
        setAiError(results[0]?.error || 'AI edit failed. Please try again.');
      } else {
        setAiResults(succeeded);
        applyAiResult(succeeded[0].image_url);
        setCurrentSourceUrl(succeeded[0].image_url);
      }
    } catch (e) {
      setAiError(e?.detail || e?.message || 'AI edit failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  // Persisting to the gallery only ever happens through this one path, fired
  // only by the explicit "Save to Gallery" button (and its "Save" choice in
  // the leave-without-saving prompt) — Download is a local-only export and
  // must never create a gallery row on its own.
  const handleSave = async () => {
    if (!fabricRef.current || saving) return false;
    setSaving(true);
    try {
      const canvas = fabricRef.current;
      const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 });
      const saved = await creativesApi.saveCanvas({
        image_data: dataUrl,
        name: `${creative?.name || 'Creative'} — edited`,
        campaign_id: creative?.campaign?.id || null,
        creative_id: creative?.id || null,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      savedHistoryIndexRef.current = historyIndexRef.current;
      onSaved?.(saved);
      return true;
    } catch (e) {
      setError(e?.detail || e?.message || 'Save failed — an externally-hosted layer may be blocking canvas export (CORS).');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    const canvas = fabricRef.current;
    if (!canvas || downloading) return;
    setDownloading(true);
    try {
      const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${creative?.name || 'creative'}-edited.png`;
      link.click();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (e) {
      setError(e?.detail || e?.message || 'Download failed — an externally-hosted layer may be blocking canvas export (CORS).');
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveAndClose = async () => {
    const ok = await handleSave();
    if (ok) { setShowLeaveConfirm(false); onClose(); }
  };

  // layersTick forces a re-render whenever the canvas object list changes
  const layerObjects = fabricRef.current
    ? fabricRef.current.getObjects().filter(o => !o._isCropRect).slice().reverse()
    : [];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
      </div>
    );
  }

  if (!creative) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400 text-sm">{error || 'Creative not found.'}</p>
        <button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-white text-sm font-bold transition-all">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-white relative">
      {/* ── Leave without saving? ── */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowLeaveConfirm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[rgba(16,20,29,0.55)] backdrop-blur-xl backdrop-saturate-150 border border-amber-500/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center"
              onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-sm font-black text-white mb-1">Unsaved changes</h3>
              <p className="text-xs text-slate-500 mb-5">Save this edit to the gallery before leaving, or discard it.</p>
              <div className="flex flex-col gap-2">
                <button onClick={handleSaveAndClose} disabled={saving}
                  className="w-full py-2.5 bg-(--accent) hover:bg-(--accent-hover) disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                  {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : <><Save className="w-3.5 h-3.5" /> Save to Gallery</>}
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setShowLeaveConfirm(false)}
                    className="flex-1 py-2.5 bg-white/5 border border-white/8 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all">
                    Cancel
                  </button>
                  <button onClick={onClose}
                    className="flex-1 py-2.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all">
                    Discard Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 flex-wrap"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={requestClose}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
          <div className="w-9 h-9 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] rounded-xl flex items-center justify-center shrink-0">
            <Wand2 className="w-4 h-4 text-(--accent)" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white uppercase tracking-wider truncate max-w-64">{creative.name}</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">{canvasDims.w} × {canvasDims.h} px</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {error && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="text-xs text-red-400 max-w-xs truncate">{error}</span>
              <button onClick={() => setError('')} className="text-red-400/60 hover:text-red-400"><X className="w-3 h-3" /></button>
            </div>
          )}

          <div className="flex items-center gap-1">
            <button onClick={handleUndo} disabled={!canUndo}
              className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:hover:bg-transparent rounded-xl transition-all">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={handleRedo} disabled={!canRedo}
              className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:hover:bg-transparent rounded-xl transition-all">
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <div className="w-px h-5 bg-white/8" />

          <button onClick={handleResetAll}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/4 border border-white/6 hover:bg-white/6 text-slate-400 hover:text-white rounded-xl font-bold text-xs transition-all">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button onClick={handleDownload} disabled={downloading}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs transition-all shadow-lg disabled:opacity-50 ${downloadSuccess ? 'bg-green-600 hover:bg-green-500 shadow-green-600/20' : 'bg-white/4 border border-white/6 hover:bg-white/6 text-slate-300 hover:text-white'}`}>
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : downloadSuccess ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
            {downloading ? 'Downloading…' : downloadSuccess ? 'Downloaded!' : 'Download'}
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs transition-all shadow-lg disabled:opacity-50 ${saveSuccess ? 'bg-green-600 hover:bg-green-500 shadow-green-600/20' : 'bg-(--accent) hover:bg-(--accent-hover) shadow-accent-glow'} text-white`}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : saveSuccess ? 'Saved!' : 'Save to Gallery'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: hero canvas ── */}
        <div ref={containerRef} className="flex-1 flex items-center justify-center p-6 md:p-10 overflow-hidden relative">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl"
            style={canvasReady ? { width: canvasDims.w, height: canvasDims.h } : { width: '100%', height: '100%' }}>
            <img src={creativeProxyUrl(creative.id)} alt={creative.name}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ opacity: canvasReady ? 0 : 1, transition: 'opacity 0.3s ease' }} />
            <canvas ref={canvasRef} style={{ opacity: canvasReady ? 1 : 0, transition: 'opacity 0.3s ease' }} />
            {/* Snap guide lines */}
            <div ref={guideHRef} style={{ display: 'none', position: 'absolute', left: 0, right: 0, height: 1, background: 'rgba(168,85,247,0.9)', pointerEvents: 'none', zIndex: 20 }} />
            <div ref={guideVRef} style={{ display: 'none', position: 'absolute', top: 0, bottom: 0, width: 1, background: 'rgba(168,85,247,0.9)', pointerEvents: 'none', zIndex: 20 }} />
            {/* Mask drawing overlay for Erase tool */}
            <canvas
              ref={maskCanvasRef}
              width={canvasDims.w || 1}
              height={canvasDims.h || 1}
              style={{
                position: 'absolute', top: 0, left: 0, zIndex: 18,
                opacity: activePanel === 'erase' ? 0.55 : 0,
                pointerEvents: activePanel === 'erase' ? 'auto' : 'none',
                cursor: activePanel === 'erase' ? 'crosshair' : 'default',
              }}
              onPointerDown={onMaskPointerDown}
              onPointerMove={onMaskPointerMove}
              onPointerUp={onMaskPointerUp}
              onPointerLeave={onMaskPointerUp}
            />
          </div>
        </div>

        {/* ── Right: tools sidebar — slides in ── */}
        <motion.div
          initial={{ x: 32, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 32 }}
          className="w-80 shrink-0 flex flex-col overflow-hidden"
          style={{ borderLeft: '1px solid var(--border-subtle)' }}>

          {/* Tool tabs */}
          <div className="flex gap-1 p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            {[
              { id: 'ai', icon: Wand2, label: 'AI Edit' },
              { id: 'logos', icon: ImageIcon, label: 'Logo' },
              { id: 'images', icon: Upload, label: 'Image' },
              { id: 'text', icon: Type, label: 'Text' },
              { id: 'crop', icon: Crop, label: 'Crop' },
              { id: 'erase', icon: Eraser, label: 'Erase' },
              { id: 'layers', icon: Layers, label: 'Layers' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActivePanel(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                  activePanel === tab.id
                    ? tab.id === 'ai' ? 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-(--accent-hover)' : 'bg-white/8 text-white'
                    : 'text-slate-600 hover:text-slate-400'
                }`}>
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tool tab content */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {activePanel === 'ai' && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="space-y-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)]">
                  <Sparkles className="w-3.5 h-3.5 text-(--accent) shrink-0" />
                  <p className="text-[10px] text-(--accent-hover) font-bold uppercase tracking-widest">AI-Powered Editing</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] text-gray-600 uppercase tracking-widest">Describe your edit</label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => { setAiPrompt(e.target.value); setAiError(''); }}
                    placeholder="e.g. Remove the background and add a soft studio glow..."
                    rows={4}
                    className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-white placeholder:text-gray-700 outline-none focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] transition-all resize-none"
                  />
                </div>

                <AiAspectRatioPicker ratios={aiRatios} onChange={(r) => { setAiRatios(r); setAiError(''); }} />

                <button onClick={handleAiEdit} disabled={!aiPrompt.trim() || aiLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-(--accent) hover:bg-(--accent-hover) disabled:opacity-30 disabled:hover:bg-(--accent) text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-accent-glow">
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  {aiLoading ? 'Generating…' : 'Generate with AI'}
                </button>

                {aiError && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-300/80 leading-relaxed">{aiError}</p>
                  </motion.div>
                )}

                {aiResults.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest">
                      {aiResults.length === 1 ? 'Result applied to canvas' : `${aiResults.length} variants — click to apply`}
                    </p>
                    {aiResults.length > 1 && (
                      <div className="grid grid-cols-2 gap-2">
                        {aiResults.map((r, i) => (
                          <button key={r.id || i} onClick={() => { applyAiResult(r.image_url); setCurrentSourceUrl(r.image_url); }}
                            className="relative aspect-square rounded-lg overflow-hidden border border-white/8 hover:border-[color-mix(in_srgb,var(--accent)_50%,transparent)] transition-all group">
                            <img src={r.image_url} className="w-full h-full object-cover" alt={`variant ${i + 1}`} loading="lazy" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-end justify-center pb-1.5">
                              <span className="text-[9px] font-bold text-white/0 group-hover:text-white/90 uppercase tracking-widest transition-all">{r.ratio}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}

            {activePanel === 'logos' && (
              <div className="space-y-2">
                <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">
                  {logoPlacementLoading ? 'Analyzing image…' : 'Click to place on canvas'}
                </p>
                {brandLogos.length === 0 ? (
                  <p className="text-[10px] text-gray-600 text-center py-8 leading-relaxed">
                    No logos uploaded.<br />Add them in Brand Kit.
                  </p>
                ) : brandLogos.map(logo => (
                  <button key={logo.id} onClick={() => handleAddLogo(logo)} disabled={logoPlacementLoading}
                    className="w-full flex items-center gap-2 p-2 bg-black/40 hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-white/5 hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] rounded-xl transition-all group text-left disabled:opacity-50">
                    <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden shrink-0 border border-white/5">
                      {logo.file_url
                        ? <img src={logo.file_url} className="w-full h-full object-contain p-0.5" alt={logo.name} />
                        : <div className="w-4 h-4 rounded bg-white/10" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-gray-300 truncate group-hover:text-white">{logo.name}</p>
                      {logo.is_primary && <p className="text-[9px] text-(--accent) font-bold uppercase tracking-widest">Primary</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {activePanel === 'images' && (
              <div className="space-y-4">
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadImage} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/4 border border-dashed border-white/12 hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] rounded-xl text-xs text-slate-400 hover:text-(--accent-hover) font-black uppercase tracking-widest transition-all">
                    <Plus className="w-3.5 h-3.5" /> Upload Image
                  </button>
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] text-gray-600 uppercase tracking-widest">Your Creatives</p>
                  {otherCreatives.length === 0 ? (
                    <p className="text-[10px] text-gray-600 py-4">No other photos yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {otherCreatives.slice(0, 24).map(c => (
                        <button key={c.id} onClick={() => handleAddCreativeImage(c)}
                          className="aspect-4/5 rounded-lg overflow-hidden border border-white/6 hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] transition-all">
                          <img src={creativeProxyUrl(c.id)} className="w-full h-full object-cover" alt={c.name} loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activePanel === 'text' && (
              <div className="space-y-3">
                <button onClick={handleAddText}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/4 border border-dashed border-white/12 hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] rounded-xl text-xs text-slate-400 hover:text-(--accent-hover) font-black uppercase tracking-widest transition-all">
                  <Plus className="w-3.5 h-3.5" /> Add Text
                </button>
                <p className="text-[10px] text-gray-600 leading-relaxed">Click a text layer to select it, then edit its content, font, and style in the Properties panel below.</p>
              </div>
            )}

            {activePanel === 'crop' && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="space-y-3">
                {!isCropping ? (
                  <>
                    <p className="text-[10px] text-gray-600 leading-relaxed">Draw a crop box over the canvas, adjust its handles, then apply to permanently crop the composition.</p>
                    <button onClick={startCrop}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/4 border border-dashed border-white/12 hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] rounded-xl text-xs text-slate-400 hover:text-(--accent-hover) font-black uppercase tracking-widest transition-all">
                      <Crop className="w-3.5 h-3.5" /> Start Crop
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] text-gray-600 leading-relaxed">Drag the handles on the canvas, then apply — this merges current layers into the image.</p>
                    <div className="flex gap-2">
                      <button onClick={applyCrop}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-(--accent) hover:bg-(--accent-hover) text-white rounded-xl font-black text-xs transition-all shadow-lg shadow-accent-glow">
                        Apply Crop
                      </button>
                      <button onClick={cancelCrop}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white/4 border border-white/6 hover:bg-white/6 text-slate-400 hover:text-white rounded-xl font-bold text-xs transition-all">
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {activePanel === 'erase' && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="space-y-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                  <Eraser className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <p className="text-[10px] text-red-300 font-bold uppercase tracking-widest">Erase & Fill</p>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">Paint over the area you want to remove, then describe what should replace it.</p>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-[9px] text-gray-600 uppercase tracking-widest">Brush Size</label>
                    <span className="text-[9px] text-gray-400 font-mono">{eraseBrushSize}px</span>
                  </div>
                  <input type="range" min="10" max="200" step="5" value={eraseBrushSize}
                    onChange={(e) => setEraseBrushSize(parseInt(e.target.value))}
                    className="w-full accent-red-500 h-1.5 rounded-full cursor-pointer" />
                </div>

                <div className="flex gap-2">
                  <button onClick={clearMask} disabled={!hasMask}
                    className="flex-1 py-2.5 bg-white/4 border border-white/6 hover:bg-white/8 disabled:opacity-30 text-slate-400 hover:text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all">
                    Clear
                  </button>
                  <button onClick={handleEraseApply} disabled={!hasMask || erasing}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-red-600/20">
                    {erasing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eraser className="w-3.5 h-3.5" />}
                    {erasing ? 'Erasing…' : 'Erase'}
                  </button>
                </div>

                {!hasMask && (
                  <p className="text-[9px] text-gray-600 text-center">Paint on the canvas to mark the area</p>
                )}
              </motion.div>
            )}

            {activePanel === 'layers' && (
              <div className="space-y-2">
                {layerObjects.length === 0 ? (
                  <p className="text-[10px] text-gray-600 text-center py-8">No layers yet. Add a logo, image, or text to get started.</p>
                ) : layerObjects.map((obj, i) => (
                  <div key={i} onClick={() => selectLayer(obj)}
                    className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${fabricRef.current?.getActiveObject() === obj ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border-[color-mix(in_srgb,var(--accent)_30%,transparent)]' : 'bg-black/30 border-white/5 hover:border-white/15'}`}>
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                      {obj._layerType === 'text' ? <Type className="w-3.5 h-3.5 text-amber-400" /> : <ImageIcon className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                    <p className="text-[10px] font-bold text-gray-300 truncate flex-1">
                      {obj._layerType === 'text' ? (obj.text || 'Text').slice(0, 20) : (obj._layerName || 'Layer')}
                    </p>
                    <button onClick={(e) => { e.stopPropagation(); deleteLayer(obj); }} className="p-1 text-slate-600 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Properties — always available below the tool tabs */}
          <div className="shrink-0 overflow-y-auto" style={{ borderTop: '1px solid var(--border-subtle)', maxHeight: '46%' }}>
            <div className="px-4 py-2.5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Properties</p>
            </div>

            <div className="px-4 pb-4 space-y-4">
              {!hasSelection ? (
                <p className="text-[10px] text-gray-600 text-center py-4 leading-relaxed">Select a layer on the canvas or from the Layers tab to edit its properties.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Size</label>
                      <span className="text-[10px] text-gray-400 font-mono">{Math.round(activeScale * 100)}%</span>
                    </div>
                    <input type="range" min="0.05" max="3" step="0.01" value={activeScale}
                      onChange={(e) => handleScale(parseFloat(e.target.value))} onMouseUp={commitChange} onTouchEnd={commitChange}
                      className="w-full accent-(--accent) h-1.5 rounded-full cursor-pointer" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Opacity</label>
                      <span className="text-[10px] text-gray-400 font-mono">{Math.round(activeOpacity * 100)}%</span>
                    </div>
                    <input type="range" min="0.05" max="1" step="0.01" value={activeOpacity}
                      onChange={(e) => handleOpacity(parseFloat(e.target.value))} onMouseUp={commitChange} onTouchEnd={commitChange}
                      className="w-full accent-(--accent) h-1.5 rounded-full cursor-pointer" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Angle</label>
                      <span className="text-[10px] text-gray-400 font-mono">{activeAngle}°</span>
                    </div>
                    <input type="range" min="-180" max="180" step="1" value={activeAngle}
                      onChange={(e) => handleAngle(parseInt(e.target.value))} onMouseUp={commitChange} onTouchEnd={commitChange}
                      className="w-full accent-(--accent) h-1.5 rounded-full cursor-pointer" />
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => { handleFlip('x'); commitChange(); }}
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5">
                      <FlipHorizontal className="w-3.5 h-3.5" /> Flip H
                    </button>
                    <button onClick={() => { handleFlip('y'); commitChange(); }}
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5">
                      <FlipVertical className="w-3.5 h-3.5" /> Flip V
                    </button>
                  </div>

                  {selectedType === 'textbox' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Text</label>
                        <textarea
                          value={activeTextContent}
                          onChange={(e) => handleTextContent(e.target.value)}
                          onBlur={commitChange}
                          rows={2}
                          className="w-full bg-black/40 border border-white/8 rounded-xl p-2.5 text-xs text-white placeholder:text-gray-700 outline-none focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] transition-all resize-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Font</label>
                        <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto pr-0.5">
                          {FONTS.map(f => (
                            <button key={f} onClick={() => { handleFontFamily(f); commitChange(); }}
                              style={{ fontFamily: f }}
                              className={`px-2 py-1.5 rounded-lg text-xs transition-all truncate text-left border ${activeFontFamily === f ? 'bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] border-[color-mix(in_srgb,var(--accent)_40%,transparent)] text-white' : 'bg-white/5 border-white/8 text-gray-300 hover:bg-white/10 hover:text-white'}`}>
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Weight</label>
                        <div className="flex gap-1.5">
                          {[['400', 'Regular'], ['700', 'Bold'], ['900', 'Black']].map(([w, label]) => (
                            <button key={w} onClick={() => { handleFontWeight(w); commitChange(); }}
                              className={`flex-1 py-1.5 rounded-lg text-xs border transition-all ${activeFontWeight === w ? 'bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] border-[color-mix(in_srgb,var(--accent)_40%,transparent)] text-white' : 'bg-white/5 border-white/8 text-gray-400 hover:text-white'}`}
                              style={{ fontWeight: w }}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Align</label>
                        <div className="flex gap-1.5">
                          {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([a, Icon]) => (
                            <button key={a} onClick={() => { handleTextAlign(a); commitChange(); }}
                              className={`flex-1 py-1.5 rounded-lg border transition-all flex items-center justify-center ${activeTextAlign === a ? 'bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] border-[color-mix(in_srgb,var(--accent)_40%,transparent)] text-white' : 'bg-white/5 border-white/8 text-gray-400 hover:text-white'}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Font Size</label>
                          <span className="text-[10px] text-gray-400 font-mono">{activeFontSize}px</span>
                        </div>
                        <input type="range" min="10" max="160" step="1" value={activeFontSize}
                          onChange={(e) => handleFontSize(parseInt(e.target.value))} onMouseUp={commitChange} onTouchEnd={commitChange}
                          className="w-full accent-(--accent) h-1.5 rounded-full cursor-pointer" />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Color</label>
                        <div className="flex items-center gap-2">
                          <div className="relative w-8 h-8 rounded-lg border border-white/15 overflow-hidden shrink-0 cursor-pointer"
                            style={{ backgroundColor: activeColor }}>
                            <input type="color" value={activeColor}
                              onChange={(e) => handleTextColor(e.target.value)}
                              onBlur={commitChange}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                          </div>
                          <input type="text" value={activeColor}
                            onChange={(e) => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) handleTextColor(e.target.value); }}
                            onBlur={commitChange}
                            maxLength={7}
                            className="flex-1 bg-black/40 border border-white/8 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] transition-all"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex gap-1.5">
                    <button onClick={handleSendBackward} title="Send Backward"
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={handleBringForward} title="Bring Forward"
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={handleDuplicate} title="Duplicate"
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button onClick={handleDelete}
                    className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Layer
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
