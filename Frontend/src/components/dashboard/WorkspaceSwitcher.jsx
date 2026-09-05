import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Check, Users, ChevronDown, Loader2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const WorkspaceSwitcher = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const dropdownRef = useRef(null);
  const newNameRef = useRef(null);
  const { workspaces, activeWorkspace, switchWorkspace, createWorkspace } = useAuth();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsCreating(false);
        setNewName('');
        setCreateError('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isCreating && newNameRef.current) newNameRef.current.focus();
  }, [isCreating]);

  const filtered = workspaces.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const initials = (name) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const handleCreate = async (e) => {
    e?.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    setCreateError('');
    try {
      await createWorkspace(newName.trim());
      setIsCreating(false);
      setNewName('');
      setIsOpen(false);
    } catch (err) {
      setCreateError(err.message || 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  if (!activeWorkspace) return null;

  const TIER_COLORS = {
    free:       'bg-slate-500/10 text-slate-400 border-slate-500/20',
    individual: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    team:       'bg-purple-500/10 text-purple-400 border-purple-500/20',
    enterprise: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setIsOpen(!isOpen); setIsCreating(false); setNewName(''); }}
        className="flex items-center gap-3 px-4 py-2 bg-[#10141d] border border-white/10 rounded-xl hover:border-white/20 transition-all cursor-pointer group shadow-lg"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          <span className="text-xs font-bold text-white uppercase tracking-wider truncate max-w-[60px] xs:max-w-[100px] sm:max-w-none">
            {activeWorkspace.name}<span className="hidden sm:inline"> Workspace</span>
          </span>
        </div>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 sm:left-0 mt-2 w-screen max-w-[280px] sm:w-72 bg-[#10141d] border border-white/5 rounded-2xl shadow-2xl z-50 overflow-hidden ring-1 ring-white/10">

          {/* Search */}
          {!isCreating && (
            <div className="p-3 border-b border-white/5 bg-black/20">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search workspaces"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-sm text-white pl-9 placeholder:text-gray-600"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* List */}
          {!isCreating && (
            <div className="max-h-[300px] overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <p className="text-center text-xs text-slate-600 py-4">No workspaces found</p>
              ) : (
                filtered.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => { switchWorkspace(ws); setIsOpen(false); setSearchQuery(''); }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all hover:bg-white/5 ${activeWorkspace?.id === ws.id ? 'bg-white/5' : ''}`}
                  >
                    <div className="w-10 h-10 rounded-md bg-blue-600/20 flex items-center justify-center shrink-0">
                      <span className="font-bold text-sm text-white">{initials(ws.name)}</span>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">{ws.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase border shrink-0 ${TIER_COLORS[ws.plan_tier] || TIER_COLORS.free}`}>
                          {ws.plan_tier || 'free'}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-600 truncate flex items-center gap-1">
                        <Users className="w-2.5 h-2.5 inline" /> {ws.member_count || 1} member{ws.member_count !== 1 ? 's' : ''}
                        {ws.role && <> · <span className="capitalize">{ws.role}</span></>}
                      </p>
                    </div>
                    {activeWorkspace?.id === ws.id && (
                      <Check className="w-4 h-4 text-white shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Create Workspace form */}
          {isCreating ? (
            <div className="p-3">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 px-0.5">New Workspace</p>
              <form onSubmit={handleCreate} className="space-y-2">
                <input
                  ref={newNameRef}
                  type="text"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setCreateError(''); }}
                  onKeyDown={(e) => e.key === 'Escape' && setIsCreating(false)}
                  placeholder="Workspace name..."
                  maxLength={50}
                  className="w-full bg-black/30 border border-white/10 focus:border-blue-500 rounded-xl py-2.5 px-3 text-sm text-white outline-none transition-all placeholder:text-gray-600"
                />
                {createError && <p className="text-[10px] text-red-400 px-0.5">{createError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!newName.trim() || creating}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition-all"
                  >
                    {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsCreating(false); setNewName(''); setCreateError(''); }}
                    className="px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-black rounded-xl transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-1.5 border-t border-white/5">
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-md bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                  <Plus className="w-5 h-5 text-gray-400" />
                </div>
                <span className="text-sm font-bold text-white uppercase tracking-tight">Create workspace</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
