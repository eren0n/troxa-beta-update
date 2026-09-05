import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, workspaceApi, billingApi, setTokens, clearTokens } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    try {
      const data = await billingApi.credits();
      setCredits(data);
      return data;
    } catch (_) {
      return null;
    }
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const data = await workspaceApi.list();
      setWorkspaces(data);
      return data;
    } catch (_) {
      return [];
    }
  }, []);

  const resolveActiveWorkspace = useCallback((wsData) => {
    const savedId = localStorage.getItem('active_workspace_id');
    const ws = wsData.find((w) => w.id === savedId) || wsData[0];
    if (ws) {
      setActiveWorkspace(ws);
      localStorage.setItem('active_workspace_id', ws.id);
    }
    return ws || null;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const userData = await authApi.me();
        setUser(userData);
        const wsData = await fetchWorkspaces();
        resolveActiveWorkspace(wsData);
        await fetchCredits();
      } catch (_) {
        clearTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password, totp_code) => {
    const response = await authApi.login(email, password, totp_code);
    if (response.requires_2fa) return { requires_2fa: true };
    setTokens(response.access, response.refresh);
    const userData = await authApi.me();
    setUser(userData);
    const wsData = await fetchWorkspaces();
    resolveActiveWorkspace(wsData);
    await fetchCredits();
    return userData;
  };

  const _finalizeGoogleLogin = async (response) => {
    setTokens(response.access, response.refresh);
    const userData = await authApi.me();
    setUser(userData);
    const wsData = await fetchWorkspaces();
    resolveActiveWorkspace(wsData);
    await fetchCredits();
    return userData;
  };

  const loginWithGoogle = async (access_token, totp_code) => {
    const response = await authApi.googleLogin(access_token, totp_code);
    if (response.action === 'link_required') return response;
    if (response.requires_2fa) return response;
    return _finalizeGoogleLogin(response);
  };

  const linkGoogleAccount = async (access_token, password) => {
    const response = await authApi.googleLink(access_token, password);
    return _finalizeGoogleLogin(response);
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
    setCredits(null);
  };

  const register = async (data) => {
    return authApi.register(data);
  };

  const switchWorkspace = useCallback((ws) => {
    setActiveWorkspace(ws);
    localStorage.setItem('active_workspace_id', ws.id);
    window.location.reload();
  }, []);

  const refreshCredits = () => fetchCredits();

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.me();
      setUser(userData);
      return userData;
    } catch (_) {}
  }, []);

  const createWorkspace = useCallback(async (name) => {
    const ws = await workspaceApi.create(name);
    const wsData = await fetchWorkspaces();
    const created = wsData.find((w) => w.id === ws.id) || ws;
    setActiveWorkspace(created);
    localStorage.setItem('active_workspace_id', created.id);
    await fetchCredits();
    return created;
  }, [fetchWorkspaces, fetchCredits]);

  const value = {
    user,
    workspaces,
    activeWorkspace,
    credits,
    loading,
    isAuthenticated: !!user,
    isDataUser: !!user?.is_data_user,
    isFreeTier: activeWorkspace?.tier === 'free' || credits?.plan_tier === 'free',
    isIndividualTier: activeWorkspace?.tier === 'individual' || credits?.plan_tier === 'individual',
    isAdmin: ['owner', 'admin'].includes(activeWorkspace?.role),
    isEditor: ['owner', 'admin', 'editor'].includes(activeWorkspace?.role),
    isAnalyst: activeWorkspace?.role === 'analyst',
    login,
    loginWithGoogle,
    linkGoogleAccount,
    logout,
    register,
    switchWorkspace,
    createWorkspace,
    refreshCredits,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
