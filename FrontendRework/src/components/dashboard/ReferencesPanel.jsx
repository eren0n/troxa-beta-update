import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageIcon, X } from 'lucide-react';
import { GLASS_STYLE } from '../ui/GlassCard';
import { creativesApi } from '../../lib/api';
import { CreativeImg } from '../ui/CreativeImg';
import UploadCreativeButton from './UploadCreativeButton';

const PAGE_SIZE = 24;

/**
 * Brand Kit → References.
 *
 * The material generations are built from: images uploaded here, plus any
 * generated creative someone promoted from the gallery. This is the same set
 * the Generate tab's reference grid offers, so what a person curates here is
 * exactly what they get to pick from later — previously that grid showed the
 * entire gallery and there was nowhere to curate at all.
 */
export default function ReferencesPanel({ isEditor }) {
  const [refs, setRefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await creativesApi.gallery({
        is_reference: 'true', media_type: 'Photo', page: 1, page_size: PAGE_SIZE,
      });
      setRefs(res?.results || res || []);
    } catch (_) {
      setRefs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const removeReference = async (id) => {
    setBusyId(id);
    try {
      await creativesApi.updateFeedback(id, { is_reference: false });
      setRefs(prev => prev.filter(r => r.id !== id));
    } catch (_) {
      // leave the card in place; the list reloads on the next visit
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={GLASS_STYLE} className="rounded-2xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-black text-white">Reference Images</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            What generations are built from — uploads, plus creatives promoted from the gallery.
            These are the images the Generate tab offers as references.
          </p>
        </div>
        {isEditor && <UploadCreativeButton onUploaded={load} />}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-4/5 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : refs.length === 0 ? (
        <div className="py-14 text-center space-y-2">
          <ImageIcon className="w-7 h-7 text-slate-700 mx-auto" />
          <p className="text-xs text-slate-500">No reference images yet.</p>
          <p className="text-[11px] text-slate-600">
            Upload one here, or open the gallery and use “Make reference” on a creative.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <AnimatePresence>
            {refs.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                // the ratio belongs to the tile; the image fills it, so the
                // caption strip sits on the bottom edge rather than floating
                // over a taller box
                className="group relative aspect-4/5 rounded-xl overflow-hidden border border-white/6 bg-black"
              >
                <CreativeImg creativeId={c.id} alt={c.name} loading="lazy" decoding="async"
                  className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-[10px] font-bold text-white truncate">{c.name}</p>
                  <span className="text-[9px] text-slate-400 uppercase tracking-widest">
                    {c.source === 'uploaded' ? 'Uploaded' : 'From gallery'}
                  </span>
                </div>
                {isEditor && (
                  <button
                    onClick={() => removeReference(c.id)}
                    disabled={busyId === c.id}
                    title="Remove from references"
                    className="absolute top-2 right-2 p-1 rounded-lg bg-black/60 border border-white/10 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-40"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
