import { useState, useEffect, useCallback } from 'react';
import { Key, Plug, Check, Trash2, Copy, ExternalLink, Hash, Loader2, HardDrive, FolderOpen, Download, Search, X, RefreshCw, ToggleLeft, ToggleRight, ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import LockedFeature from '../../components/dashboard/LockedFeature';

const SlackIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="currentColor"/>
  </svg>
);

function SlackCard({ activeWorkspace }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const token = localStorage.getItem('access_token');
  const wsId = activeWorkspace?.id;

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/slack/status/', {
        headers: { Authorization: `Bearer ${token}`, 'X-Workspace-ID': wsId },
      });
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false, troxa_key: wsId });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, [wsId]);

  // Handle ?slack=installed from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack') === 'installed') {
      fetchStatus();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/slack/install/', {
        headers: { Authorization: `Bearer ${token}`, 'X-Workspace-ID': wsId },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      window.location.href = '/api/slack/install/';
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch('/api/slack/disconnect/', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'X-Workspace-ID': wsId },
      });
      setStatus(s => ({ ...s, connected: false, team_name: undefined, channel_name: undefined }));
    } finally {
      setDisconnecting(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(status?.troxa_key || wsId || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#10141d] border border-white/5 rounded-3xl p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
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
            <p className="text-xs text-gray-500">Send generation results directly to a Slack channel</p>
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
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Add to Slack
          </button>
        )}
      </div>

      {/* Connected info */}
      {!loading && status?.connected && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl"
        >
          <Hash className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs font-bold text-emerald-400">
              #{status.channel_name || status.channel_id} · {status.team_name}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Generation results will be posted to this channel automatically
            </p>
          </div>
        </motion.div>
      )}

      {/* Setup instructions */}
      {!loading && !status?.connected && (
        <div className="space-y-4">
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

            {/* Command */}
            <div className="mt-1">
              <p className="text-[10px] text-gray-600 mb-1.5 font-mono uppercase tracking-widest">Slack command</p>
              <div className="flex items-center gap-2 p-3 bg-[#06090f] border border-white/8 rounded-xl font-mono text-xs">
                <span className="text-blue-400 select-none">/troxa setup</span>
                <span className="text-yellow-300 truncate flex-1">{status?.troxa_key || wsId || '…'}</span>
                <button
                  onClick={copyKey}
                  className="text-gray-500 hover:text-white transition-colors shrink-0 p-1"
                  title="Copy command"
                >
                  <AnimatePresence mode="wait">
                    {copied ? (
                      <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      </motion.div>
                    ) : (
                      <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <Copy className="w-3.5 h-3.5" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </div>
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
                          isSelected ? 'border-blue-500 shadow-[0_0_14px_rgba(59,130,246,0.3)]' : 'border-white/5 hover:border-white/15'
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
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
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

function DriveCard({ activeWorkspace }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [togglingSync, setTogglingSync] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importSuccess, setImportSuccess] = useState(null);

  const token = localStorage.getItem('access_token');
  const wsId = activeWorkspace?.id;

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/drive/status/', {
        headers: { Authorization: `Bearer ${token}`, 'X-Workspace-ID': wsId },
      });
      setStatus(await res.json());
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, [wsId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('drive') === 'connected') {
      fetchStatus();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/drive/install/', {
        headers: { Authorization: `Bearer ${token}`, 'X-Workspace-ID': wsId },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch('/api/drive/disconnect/', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'X-Workspace-ID': wsId },
      });
      setStatus({ connected: false });
    } finally {
      setDisconnecting(false);
    }
  };

  const toggleAutoSync = async () => {
    setTogglingSync(true);
    try {
      const res = await fetch('/api/drive/auto-sync/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Workspace-ID': wsId },
        body: JSON.stringify({ auto_sync: !status.auto_sync }),
      });
      const data = await res.json();
      setStatus(s => ({ ...s, auto_sync: data.auto_sync }));
    } finally {
      setTogglingSync(false);
    }
  };

  return (
    <>
      <div className="bg-[#10141d] border border-white/5 rounded-3xl p-8 space-y-6">
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
              <p className="text-xs text-gray-500">Import assets from Drive or auto-sync generations to a Drive folder</p>
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
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Connect Drive
            </button>
          )}
        </div>

        {/* Connected state */}
        {!loading && status?.connected && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {/* Account info */}
            <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl">
              <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-emerald-400 truncate">{status.drive_email}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Generations will sync to <span className="text-white font-bold">Troxa.ai Generations</span> folder</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-xl text-xs font-bold transition-all"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Import from Drive
              </button>

              <button
                onClick={toggleAutoSync}
                disabled={togglingSync}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/8 border border-white/8 text-gray-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                {togglingSync ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : status.auto_sync ? (
                  <ToggleRight className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-4 h-4 text-gray-500" />
                )}
                Auto-sync generations
              </button>
            </div>

            {importSuccess !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <p className="text-xs font-bold text-emerald-400">{importSuccess} file{importSuccess !== 1 ? 's' : ''} imported to Brand Kit</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showImport && (
          <DriveImportModal
            wsId={wsId}
            token={token}
            onClose={() => setShowImport(false)}
            onImported={(count) => {
              setImportSuccess(count);
              setTimeout(() => setImportSuccess(null), 4000);
            }}
          />
        )}
      </AnimatePresence>
    </>
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

      {/* Google Drive */}
      <DriveCard activeWorkspace={activeWorkspace} />

      {/* API Keys */}
      <div className="bg-[#10141d] border border-white/5 rounded-3xl p-8 space-y-5">
        <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-yellow-500" /> API Keys
        </h3>
        {[
          { label: 'Production Key', key: 'trx_live_••••••••••••••••••••3f9a', created: 'May 12, 2025' },
          { label: 'Development Key', key: 'trx_dev_••••••••••••••••••••8c2b', created: 'Apr 3, 2025' },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.06 }}
            className="flex items-center justify-between gap-4 p-4 bg-black/40 border border-white/5 rounded-2xl"
          >
            <div>
              <p className="text-sm font-bold text-white">{item.label}</p>
              <p className="text-xs text-gray-500 font-mono mt-0.5">{item.key}</p>
              <p className="text-[10px] text-gray-600 mt-1">Created {item.created}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => copyKey(item.key)}
                className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 border border-white/5 transition-all"
              >
                <AnimatePresence mode="wait">
                  {copiedKey === item.key ? (
                    <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <Check className="w-4 h-4 text-emerald-400" />
                    </motion.div>
                  ) : (
                    <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <Copy className="w-4 h-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
              <button className="p-2 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/5 border border-white/5 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default function Integrations() {
  const { isFreeTier } = useAuth();
  if (isFreeTier) return <LockedFeature feature="Integrations" />;
  return <IntegrationsPage />;
}
