import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { creativesApi } from '../../lib/api';

export default function UploadCreativeButton({
  onUploaded,
  campaignId,
  label = 'Upload',
  className,
  multiple = true,
  accept = 'image/*,video/*',
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      if (campaignId) fd.append('campaign_id', campaignId);
      try {
        const created = await creativesApi.upload(fd);
        onUploaded?.(created);
      } catch (_) {}
    }
    e.target.value = '';
    setUploading(false);
  };

  return (
    <>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={handleChange} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={className || 'px-4 py-2.5 bg-(--accent) hover:bg-(--accent-hover) text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-accent-glow disabled:opacity-60'}
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? 'Uploading…' : label}
      </button>
    </>
  );
}
