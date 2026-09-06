import { useState, useEffect, useCallback } from 'react';
import { Key, Plug, Check, Trash2, Copy, ExternalLink, Hash, Loader2, HardDrive, FolderOpen, Download, Search, X, RefreshCw, ToggleLeft, ToggleRight, ImageIcon, Plus, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import LockedFeature from '../../components/dashboard/LockedFeature';
import { GLASS_STYLE } from '../../components/ui/GlassCard';

const SlackIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="currentColor"/>
  </svg>
);

const CONTENT_TYPE_LABELS = {
  creatives: 'Creatives',
  videos: 'Videos',
  logos: 'Edits',
  automation: 'Automation',
};

function ChannelRow({ sc, headers, onUpdate, onDelete }) {
  const [label, setLabel] = useState(sc.label || '');
  const [deleting, setDeleting] = useState(false);

  const saveLabel = async () => {
    if (label === (sc.label || '')) return;
    try {
      const res = await fetch(`/api/slack/channels/${sc.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ label }),
      });
      onUpdate(await res.json());
    } catch {}
  };

  const toggleType = async (type) => {
    const current = sc.content_types || [];
    const next = current.includes(type) ? current.filter(t => t !== type) : [...current, type];
    onUpdate({ ...sc, content_types: next });
    try {
      const res = await fetch(`/api/slack/channels/${sc.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ content_types: next }),
      });
      onUpdate(await res.json());
    } catch {
      onUpdate(sc);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/slack/channels/${sc.id}/`, { method: 'DELETE', headers });
      onDelete(sc.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 bg-black/30 border border-white/8 rounded-2xl space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="w-3.5 h-3.5 text-[#4a154b] shrink-0" />
          <span className="text-sm font-bold text-white truncate">{sc.channel_name || sc.channel_id}</span>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      <input
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onBlur={saveLabel}
        placeholder="Channel label (optional)…"
        className="w-full bg-black/40 border border-white/8 focus:border-white/20 rounded-xl py-1.5 px-3 text-xs text-white outline-none transition-all placeholder:text-gray-700"
      />

      <div>
        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-2">Post content types</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(CONTENT_TYPE_LABELS).map(([key, lbl]) => {
            const active = (sc.content_types || []).includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleType(key)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                  active
                    ? 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] border-[color-mix(in_srgb,var(--accent)_30%,transparent)] text-(--accent)'
                    : 'bg-white/3 border-white/8 text-gray-600 hover:text-gray-400 hover:border-white/15'
                }`}
              >
                {lbl}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AddChannelPanel({ headers, existingIds, onAdd, onClose }) {
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(null);

  useEffect(() => {
    fetch('/api/slack/available-channels/', { headers })
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setAvailable(d.channels || []);
      })
      .catch(() => setError('network_error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = available.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) && !existingIds.has(c.id)
  );

  const addChannel = async (channel) => {
    setAdding(channel.id);
    try {
      const res = await fetch('/api/slack/channels/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          channel_id: channel.id,
          channel_name: channel.name,
          content_types: ['creatives', 'videos', 'logos', 'automation'],
        }),
      });
      onAdd(await res.json());
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="p-4 bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] rounded-2xl space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-(--accent)">Add a channel</p>
        <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-4 h-4 text-(--accent) animate-spin" />
        </div>
      ) : error ? (
        <div className="py-4 text-center">
          <p className="text-xs text-red-400">Could not load channels — {error}</p>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search channels…"
            autoFocus
            className="w-full bg-black/40 border border-white/8 focus:border-white/20 rounded-xl py-1.5 px-3 text-xs text-white outline-none transition-all placeholder:text-gray-700"
          />
          <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">No channels found</p>
            ) : (
              filtered.map(c => (
                <button key={c.id} onClick={() => addChannel(c)} disabled={!!adding}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white/3 hover:bg-white/8 border border-white/5 text-left transition-all disabled:opacity-60">
                  {adding === c.id
                    ? <Loader2 className="w-3 h-3 animate-spin text-(--accent)" />
                    : <Hash className="w-3 h-3 text-gray-600" />}
                  <span className="text-xs text-white flex-1">{c.name}</span>
                  {c.is_private && <span className="text-[10px] text-gray-600">Private</span>}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SlackCard({ activeWorkspace }) {
  const [status, setStatus] = useState(null);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const token = localStorage.getItem('access_token');
  const wsId = activeWorkspace?.id;
  const headers = { Authorization: `Bearer ${token}`, 'X-Workspace-ID': wsId };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/slack/status/', { headers });
      const data = await res.json();
      setStatus(data);
      setChannels(data.channels || []);
    } catch {
      setStatus({ connected: false, troxa_key: wsId });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, [wsId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack') === 'installed') {
      fetchStatus();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/slack/install/', { headers });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      window.location.href = '/api/slack/install/';
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch('/api/slack/disconnect/', { method: 'DELETE', headers });
      setStatus(s => ({ ...s, connected: false }));
      setChannels([]);
    } finally {
      setDisconnecting(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(status?.troxa_key || wsId || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const existingChannelIds = new Set(channels.map(c => c.channel_id));

  return (
    <div style={GLASS_STYLE} className="rounded-3xl p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] flex items-center justify-center text-(--accent)">
            <SlackIcon />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">Slack</p>
              {!loading && status?.connected && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <Check className="w-2.5 h-2.5" /> Connected
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">Send generation results directly to Slack channels</p>
          </div>
        </div>

        {loading ? (
          <Loader2 className="w-4 h-4 text-gray-600 animate-spin" />
        ) : status?.connected ? (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors disabled:opacity-50"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-(--accent) transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Add to Slack
          </button>
        )}
      </div>

      {/* Connected: team info + channel management */}
      {!loading && status?.connected && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Team info */}
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-400 font-bold">{status.team_name}</p>
          </div>

          {/* Channel list */}
          <div className="space-y-2">
            {channels.length === 0 && !showAdd && (
              <p className="text-xs text-gray-600 text-center py-3">No channels configured yet. Add one below.</p>
            )}
            {channels.map(sc => (
              <ChannelRow
                key={sc.id}
                sc={sc}
                headers={headers}
                onUpdate={updated => setChannels(chs => chs.map(c => c.id === updated.id ? updated : c))}
                onDelete={id => setChannels(chs => chs.filter(c => c.id !== id))}
              />
            ))}

            {showAdd ? (
              <AddChannelPanel
                headers={headers}
                existingIds={existingChannelIds}
                onAdd={sc => { setChannels(chs => [...chs, sc]); setShowAdd(false); }}
                onClose={() => setShowAdd(false)}
              />
            ) : (
              <button
                onClick={() => setShowAdd(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/3 hover:bg-white/5 border border-dashed border-white/10 text-gray-600 hover:text-gray-300 rounded-2xl text-xs font-bold transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add channel
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Not connected: setup instructions */}
      {!loading && !status?.connected && (
        <div className="p-4 bg-black/30 border border-white/5 rounded-2xl space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Setup Instructions</p>
          <ol className="space-y-2">
            {[
              'Click "Add to Slack" to install the Troxa bot to your workspace',
              'In any channel, type the command below to connect it to this workspace:',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div>
            <p className="text-[10px] text-gray-600 mb-1.5 font-mono uppercase tracking-widest">Slack command</p>
            <div className="flex items-center gap-2 p-3 bg-[#06090f] border border-white/8 rounded-xl font-mono text-xs">
              <span className="text-blue-400 select-none">/troxa setup</span>
              <span className="text-yellow-300 truncate flex-1">{status?.troxa_key || wsId || '…'}</span>
              <button onClick={copyKey} className="text-gray-500 hover:text-white transition-colors shrink-0 p-1">
                <AnimatePresence mode="wait">
                  {copied
                    ? <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check className="w-3.5 h-3.5 text-emerald-400" /></motion.div>
                    : <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Copy className="w-3.5 h-3.5" /></motion.div>
                  }
                </AnimatePresence>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const DriveIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.28 3L0 14l4.28 7.5L10.56 10.5 6.28 3zM12 10.5L7.72 21.5H21L24 16 18.56 3 12 10.5zM12 3L7.44 11.75h9.12L12 3z"/>
  </svg>
);

const FolderIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
  </svg>
);

function DriveImportModal({ wsId, token, onClose, onImported }) {
  // folder stack: [{id, name}] — null id = root
  const [folderStack, setFolderStack] = useState([{ id: null, name: 'My Drive' }]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFolder, setLoadingFolder] = useState(null); // folder id being expanded
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState(new Set()); // file ids
  const [importing, setImporting] = useState(false);
  const [nextPage, setNextPage] = useState(null);

  const currentFolder = folderStack[folderStack.length - 1];
  const headers = { Authorization: `Bearer ${token}`, 'X-Workspace-ID': wsId };

  const fetchItems = useCallback(async (folderId, q = '', pageToken = null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (folderId) params.set('folder_id', folderId);
      if (q) params.set('q', q);
      if (pageToken) params.set('page_token', pageToken);
      const res = await fetch(`/api/drive/files/?${params}`, { headers });
      const data = await res.json();
      setItems(prev => pageToken ? [...prev, ...(data.items || [])] : (data.items || []));
      setNextPage(data.next_page_token || null);
    } finally {
      setLoading(false);
    }
  }, [token, wsId]);

  useEffect(() => { fetchItems(currentFolder.id, search); }, []);

  const openFolder = (folder) => {
    setFolderStack(s => [...s, { id: folder.id, name: folder.name }]);
    setItems([]);
    setNextPage(null);
    setSearch('');
    setSearchInput('');
    fetchItems(folder.id, '');
  };

  const goBack = () => {
    if (folderStack.length <= 1) return;
    const newStack = folderStack.slice(0, -1);
    setFolderStack(newStack);
    setItems([]);
    setNextPage(null);
    setSearch('');
    setSearchInput('');
    fetchItems(newStack[newStack.length - 1].id, '');
  };

  const goTo = (idx) => {
    const newStack = folderStack.slice(0, idx + 1);
    setFolderStack(newStack);
    setItems([]);
    setNextPage(null);
    setSearch('');
    setSearchInput('');
    fetchItems(newStack[newStack.length - 1].id, '');
  };

  const doSearch = () => {
    setSearch(searchInput);
    setItems([]);
    setNextPage(null);
    fetchItems(currentFolder.id, searchInput);
  };

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const imageItems = items.filter(i => !i.isFolder);

  const selectAllVisible = () => {
    setSelected(prev => {
      const next = new Set(prev);
      imageItems.forEach(f => next.add(f.id));
      return next;
    });
  };

  const selectAllInFolder = async (folder) => {
    setLoadingFolder(folder.id);
    try {
      const res = await fetch(`/api/drive/folders/${folder.id}/images/`, { headers });
      const data = await res.json();
      setSelected(prev => {
        const next = new Set(prev);
        (data.items || []).forEach(f => next.add(f.id));
        return next;
      });
    } finally {
      setLoadingFolder(null);
    }
  };

  const handleImport = async () => {
    if (!selected.size) return;
    setImporting(true);
    try {
      const res = await fetch('/api/drive/import/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ file_ids: [...selected] }),
      });
      const data = await res.json();
      onImported(data.imported?.length || 0);
      onClose();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-[#0d1017] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Import from Google Drive</p>
              <p className="text-xs text-gray-500">Select images to add to Brand Kit</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Breadcrumb + search */}
        <div className="px-6 pt-3 pb-2 space-y-2">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 flex-wrap">
            {folderStack.map((f, idx) => (
              <span key={idx} className="flex items-center gap-1">
                {idx > 0 && <span className="text-gray-700">/</span>}
                <button
                  onClick={() => goTo(idx)}
                  className={`text-xs font-bold transition-colors ${idx === folderStack.length - 1 ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                >
                  {f.name}
                </button>
              </span>
            ))}
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="Search in this folder…"
                className="w-full bg-black/40 border border-white/8 focus:border-blue-500 rounded-xl py-2 pl-9 pr-4 text-xs text-white outline-none transition-all placeholder:text-gray-700"
              />
            </div>
            <button onClick={doSearch} className="px-3 py-2 bg-white/5 border border-white/8 text-gray-400 hover:text-white rounded-xl text-xs font-bold transition-colors">
              Search
            </button>
            {folderStack.length > 1 && (
              <button onClick={goBack} className="px-3 py-2 bg-white/5 border border-white/8 text-gray-400 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1">
                ← Back
              </button>
            )}
          </div>
        </div>

        {/* Select all bar */}
        {imageItems.length > 0 && (
          <div className="px-6 pb-2 flex items-center gap-3">
            <button
              onClick={selectAllVisible}
              className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              Select all images ({imageItems.length})
            </button>
            {selected.size > 0 && (
              <button
                onClick={() => setSelected(new Set())}
                className="text-[11px] font-bold text-gray-500 hover:text-gray-300 transition-colors"
              >
                Clear selection
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
              <ImageIcon className="w-8 h-8 text-gray-700" />
              <p className="text-sm text-gray-500">No files found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Folders row */}
              {items.filter(i => i.isFolder).map(folder => (
                <div key={folder.id} className="flex items-center justify-between gap-3 p-3 bg-white/3 border border-white/5 rounded-xl hover:border-white/10 transition-all group">
                  <button
                    onClick={() => openFolder(folder)}
                    className="flex items-center gap-3 flex-1 text-left min-w-0"
                  >
                    <FolderIcon className="w-5 h-5 text-yellow-400 shrink-0" />
                    <span className="text-sm text-white font-medium truncate">{folder.name}</span>
                  </button>
                  <button
                    onClick={() => selectAllInFolder(folder)}
                    disabled={loadingFolder === folder.id}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                  >
                    {loadingFolder === folder.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Check className="w-3 h-3" />
                    }
                    Select all
                  </button>
                </div>
              ))}

              {/* Images grid */}
              {imageItems.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mt-1">
                  {imageItems.map(file => {
                    const isSelected = selected.has(file.id);
                    return (
                      <button
                        key={file.id}
                        onClick={() => toggle(file.id)}
                        className={`relative aspect-square rounded-xl border-2 overflow-hidden transition-all group ${
                          isSelected ? 'border-blue-500 shadow-accent-glow' : 'border-white/5 hover:border-white/15'
                        }`}
                      >
                        {file.thumbnailLink
                          ? <img src={file.thumbnailLink} alt={file.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-white/5 flex items-center justify-center"><ImageIcon className="w-6 h-6 text-gray-600" /></div>
                        }
                        {isSelected && (
                          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[9px] text-white truncate">{file.name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {nextPage && !loading && (
            <button
              onClick={() => fetchItems(currentFolder.id, search, nextPage)}
              className="w-full mt-4 py-2.5 text-xs text-blue-400 hover:text-blue-300 font-bold border border-blue-500/20 rounded-xl hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Load more
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
          <p className="text-xs text-gray-500">
            {selected.size > 0 ? `${selected.size} image${selected.size > 1 ? 's' : ''} selected` : 'Click images or use "Select all"'}
          </p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors">Cancel</button>
            <button
              onClick={handleImport}
              disabled={!selected.size || importing}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Import to Brand Kit
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const DRIVE_SYNC_TYPES = [
  { key: 'sync_creatives', label: 'Creatives' },
  { key: 'sync_videos',    label: 'Videos' },
  { key: 'sync_logos',     label: 'Edits' },
];

function DriveCard({ activeWorkspace }) {
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importSuccess, setImportSuccess] = useState(null);

  const token = localStorage.getItem('access_token');
  const wsId = activeWorkspace?.id;
  const headers = { Authorization: `Bearer ${token}`, 'X-Workspace-ID': wsId };

  const fetchAll = async () => {
    try {
      const res = await fetch('/api/drive/status/', { headers });
      const data = await res.json();
      setStatus(data);
      if (data.connected) {
        const cfgRes = await fetch('/api/drive/folder-config/', { headers });
        setConfig(await cfgRes.json());
      }
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [wsId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('drive') === 'connected') {
      fetchAll();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/drive/install/', { headers });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch('/api/drive/disconnect/', { method: 'DELETE', headers });
      setStatus({ connected: false });
      setConfig(null);
    } finally {
      setDisconnecting(false);
    }
  };

  const patchConfig = async (patch) => {
    setConfig(c => ({ ...c, ...patch }));
    try {
      const res = await fetch('/api/drive/folder-config/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(patch),
      });
      setConfig(await res.json());
    } catch {}
  };

  const toggleAutoSync = async () => {
    const next = !config?.auto_sync;
    setConfig(c => ({ ...c, auto_sync: next }));
    try {
      const res = await fetch('/api/drive/auto-sync/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ auto_sync: next }),
      });
      const data = await res.json();
      setConfig(c => ({ ...c, auto_sync: data.auto_sync }));
    } catch {}
  };

  return (
    <>
      <div style={GLASS_STYLE} className="rounded-3xl p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <DriveIcon />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">Google Drive</p>
                {!loading && status?.connected && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <Check className="w-2.5 h-2.5" /> Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">Auto-sync creatives to Drive and import assets</p>
            </div>
          </div>

          {loading ? (
            <Loader2 className="w-4 h-4 text-gray-600 animate-spin" />
          ) : status?.connected ? (
            <button onClick={handleDisconnect} disabled={disconnecting}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors disabled:opacity-50">
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : (
            <button onClick={handleConnect}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> Connect Drive
            </button>
          )}
        </div>

        {/* Connected state */}
        {!loading && status?.connected && config && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Account info */}
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-400 font-bold truncate">{status.drive_email}</p>
            </div>

            {/* Auto-sync master toggle */}
            <div className="p-4 bg-black/30 border border-white/8 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Auto-sync</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Automatically upload to Troxa.ai folder in Drive</p>
                </div>
                <button onClick={toggleAutoSync}
                  className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl text-xs font-bold transition-all">
                  {config.auto_sync
                    ? <ToggleRight className="w-4 h-4 text-emerald-400" />
                    : <ToggleLeft className="w-4 h-4 text-gray-500" />}
                  <span className={config.auto_sync ? 'text-emerald-400' : 'text-gray-500'}>
                    {config.auto_sync ? 'On' : 'Off'}
                  </span>
                </button>
              </div>

              {/* Per-type toggles */}
              {config.auto_sync && (
                <div>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-2">Sync content types</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DRIVE_SYNC_TYPES.map(({ key, label }) => {
                      const active = config[key];
                      return (
                        <button key={key} onClick={() => patchConfig({ [key]: !active })}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                            active
                              ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                              : 'bg-white/3 border-white/8 text-gray-600 hover:text-gray-400 hover:border-white/15'
                          }`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Import button */}
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-xl text-xs font-bold transition-all">
              <FolderOpen className="w-3.5 h-3.5" /> Import from Drive
            </button>

            {importSuccess !== null && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <Check className="w-4 h-4 text-emerald-400" />
                <p className="text-xs font-bold text-emerald-400">{importSuccess} file{importSuccess !== 1 ? 's' : ''} imported</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showImport && (
          <DriveImportModal wsId={wsId} token={token}
            onClose={() => setShowImport(false)}
            onImported={(count) => { setImportSuccess(count); setTimeout(() => setImportSuccess(null), 4000); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

const MetaIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.92 7.067c-.13-.048-.267-.067-.406-.067-.792 0-1.52.413-2.065 1.08L12 12.52l-2.449-2.44C9.006 9.413 8.278 9 7.486 9c-.14 0-.276.019-.406.067C5.886 9.492 5 10.64 5 12s.886 2.508 2.08 2.933c.13.048.267.067.406.067.792 0 1.52-.413 2.065-1.08L12 11.48l2.449 2.44c.545.667 1.273 1.08 2.065 1.08.14 0 .276-.019.406-.067C18.114 14.508 19 13.36 19 12s-.886-2.508-2.08-2.933z"/>
  </svg>
);

function SetupStep({ num, label, done, active, children }) {
  return (
    <div className="relative">
      {/* connector line */}
      {num < 3 && (
        <div className={`absolute left-4 top-8 w-0.5 h-full -mb-2 transition-colors duration-500 ${done ? 'bg-[#1877F2]/60' : 'bg-white/8'}`} />
      )}
      <div className="flex gap-4">
        {/* circle */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black border-2 transition-all duration-500 ${
          done
            ? 'bg-[#1877F2] border-[#1877F2] text-white'
            : active
            ? 'bg-[#1877F2]/15 border-[#1877F2]/60 text-[#1877F2]'
            : 'bg-white/3 border-white/10 text-gray-600'
        }`}>
          {done ? <Check className="w-3.5 h-3.5" /> : num}
        </div>
        <div className="flex-1 pb-6">
          <p className={`text-sm font-bold mb-2 transition-colors ${done ? 'text-white' : active ? 'text-white' : 'text-gray-600'}`}>{label}</p>
          {active && children}
          {done && (
            <div className="flex items-center gap-1.5 text-xs text-[#1877F2]/80">
              <Check className="w-3 h-3" />
              <span className="font-bold">{children}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaCard({ activeWorkspace }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  // Step 2 state
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('');

  // Step 3 state
  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [savingPage, setSavingPage] = useState(false);
  const [selectedPage, setSelectedPage] = useState('');

  const token = localStorage.getItem('access_token');
  const wsId = activeWorkspace?.id;
  const headers = { Authorization: `Bearer ${token}`, 'X-Workspace-ID': wsId };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/meta/status/', { headers });
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, [wsId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('meta') === 'connected') {
      fetchStatus().then(() => {
        // auto-load accounts after OAuth
        loadAccounts();
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Load accounts when step 1 done but step 2 not done
  const loadAccounts = async () => {
    setAccountsLoading(true);
    try {
      const res = await fetch('/api/meta/accounts/', { headers });
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch {}
    setAccountsLoading(false);
  };

  // Load pages when step 2 done but step 3 not done
  const loadPages = async () => {
    setPagesLoading(true);
    try {
      const res = await fetch('/api/meta/pages/', { headers });
      const data = await res.json();
      setPages(data.pages || []);
    } catch {}
    setPagesLoading(false);
  };

  useEffect(() => {
    if (status?.connected && !status?.ad_account_id && accounts.length === 0) {
      loadAccounts();
    }
    if (status?.ad_account_id && !status?.page_id && pages.length === 0) {
      loadPages();
    }
  }, [status]);

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/meta/install/', { headers });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch('/api/meta/disconnect/', { method: 'DELETE', headers });
      setStatus({ connected: false });
    } finally {
      setDisconnecting(false);
    }
  };

  const saveAccount = async () => {
    if (!selectedAccount) return;
    const acc = accounts.find(a => a.id === selectedAccount);
    if (!acc) return;
    setSavingAccount(true);
    try {
      await fetch('/api/meta/accounts/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ ad_account_id: acc.id, ad_account_name: acc.name }),
      });
      setStatus(s => ({ ...s, ad_account_id: acc.id, ad_account_name: acc.name }));
      loadPages();
    } finally {
      setSavingAccount(false);
    }
  };

  const savePage = async () => {
    if (!selectedPage) return;
    const pg = pages.find(p => p.id === selectedPage);
    if (!pg) return;
    setSavingPage(true);
    try {
      await fetch('/api/meta/pages/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ page_id: pg.id, page_name: pg.name }),
      });
      setStatus(s => ({ ...s, page_id: pg.id, page_name: pg.name, setup_complete: true }));
    } finally {
      setSavingPage(false);
    }
  };

  const step1Done = status?.connected;
  const step2Done = !!status?.ad_account_id;
  const step3Done = !!status?.page_id;

  return (
    <div style={GLASS_STYLE} className="rounded-3xl p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 border border-[#1877F2]/20 flex items-center justify-center text-[#1877F2]">
            <MetaIcon />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">Meta Ads</p>
              {!loading && step3Done && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <Check className="w-2.5 h-2.5" /> Ready
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">Post creatives directly to Meta Ads campaigns</p>
          </div>
        </div>

        {loading ? (
          <Loader2 className="w-4 h-4 text-gray-600 animate-spin" />
        ) : step1Done ? (
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors disabled:opacity-50">
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <button onClick={handleConnect}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border border-[#1877F2]/20 text-[#1877F2] transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> Connect
          </button>
        )}
      </div>

      {/* Setup wizard */}
      {!loading && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
          {/* Step 1 */}
          <SetupStep num={1} label="Connect with Facebook" done={step1Done} active={!step1Done}>
            {step1Done
              ? status.fb_user_name
              : (
                <button onClick={handleConnect}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border border-[#1877F2]/20 text-[#1877F2] transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> Sign in with Facebook
                </button>
              )
            }
          </SetupStep>

          {/* Step 2 */}
          <SetupStep num={2} label="Select Ad Account" done={step2Done} active={step1Done && !step2Done}>
            {step2Done
              ? status.ad_account_name
              : step1Done && (
                <div className="flex gap-2">
                  {accountsLoading ? (
                    <Loader2 className="w-4 h-4 text-[#1877F2] animate-spin" />
                  ) : (
                    <>
                      <div className="relative flex-1">
                        <select
                          value={selectedAccount}
                          onChange={e => setSelectedAccount(e.target.value)}
                          className="w-full appearance-none bg-black/40 border border-white/10 focus:border-[#1877F2]/50 rounded-xl py-2 pl-3 pr-8 text-xs text-white outline-none transition-all"
                        >
                          <option value="">Select an ad account…</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <button
                        onClick={saveAccount}
                        disabled={!selectedAccount || savingAccount}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1877F2]/15 hover:bg-[#1877F2]/25 border border-[#1877F2]/30 text-[#1877F2] disabled:opacity-40 transition-all flex items-center gap-1.5"
                      >
                        {savingAccount ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Save
                      </button>
                    </>
                  )}
                </div>
              )
            }
          </SetupStep>

          {/* Step 3 */}
          <SetupStep num={3} label="Select Facebook Page" done={step3Done} active={step2Done && !step3Done}>
            {step3Done
              ? status.page_name
              : step2Done && (
                <div className="space-y-2">
                  <p className="text-[11px] text-gray-500">Your ads will appear from this page.</p>
                  <div className="flex gap-2">
                    {pagesLoading ? (
                      <Loader2 className="w-4 h-4 text-[#1877F2] animate-spin" />
                    ) : (
                      <>
                        <div className="relative flex-1">
                          <select
                            value={selectedPage}
                            onChange={e => setSelectedPage(e.target.value)}
                            className="w-full appearance-none bg-black/40 border border-white/10 focus:border-[#1877F2]/50 rounded-xl py-2 pl-3 pr-8 text-xs text-white outline-none transition-all"
                          >
                            <option value="">Select a page…</option>
                            {pages.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        </div>
                        <button
                          onClick={savePage}
                          disabled={!selectedPage || savingPage}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1877F2]/15 hover:bg-[#1877F2]/25 border border-[#1877F2]/30 text-[#1877F2] disabled:opacity-40 transition-all flex items-center gap-1.5"
                        >
                          {savingPage ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          Save
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            }
          </SetupStep>

          {/* Done state */}
          {step3Done && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="ml-12 -mt-2 p-4 bg-[#1877F2]/8 border border-[#1877F2]/20 rounded-2xl"
            >
              <p className="text-xs font-bold text-[#1877F2] mb-1">Meta Ads is configured</p>
              <p className="text-[11px] text-gray-500">
                Account: <span className="text-gray-300 font-bold">{status.ad_account_name}</span>
                <span className="mx-1.5 text-gray-700">·</span>
                Page: <span className="text-gray-300 font-bold">{status.page_name}</span>
              </p>
              <p className="text-[11px] text-gray-600 mt-1">Go to the creative gallery and select creatives to post to Meta Ads.</p>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function IntegrationsPage() {
  const { activeWorkspace } = useAuth();
  const [copiedKey, setCopiedKey] = useState(null);

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="max-w-3xl mx-auto space-y-8"
    >
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Plug className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Integrations</h1>
            <p className="text-xs text-gray-500">Connect external services and configure webhooks</p>
          </div>
        </div>
      </div>

      {/* Slack */}
      <SlackCard activeWorkspace={activeWorkspace} />

      {/* Meta Ads */}
      <MetaCard activeWorkspace={activeWorkspace} />

      {/* Google Drive */}
      <DriveCard activeWorkspace={activeWorkspace} />

    </motion.div>
  );
}

export default function Integrations() {
  const { isFreeTier } = useAuth();
  if (isFreeTier) return <LockedFeature feature="Integrations" />;
  return <IntegrationsPage />;
}
