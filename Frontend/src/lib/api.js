const BASE = '/api';

const getToken = () => localStorage.getItem('access_token');
const getRefresh = () => localStorage.getItem('refresh_token');
const getWorkspaceId = () => localStorage.getItem('active_workspace_id');

export function setTokens(access, refresh) {
  localStorage.setItem('access_token', access);
  if (refresh) localStorage.setItem('refresh_token', refresh);
}

export function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('active_workspace_id');
}

async function refreshToken() {
  const refresh = getRefresh();
  if (!refresh) throw new Error('No refresh token');
  const res = await fetch(`${BASE}/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    clearTokens();
    throw new Error('Session expired');
  }
  const data = await res.json();
  localStorage.setItem('access_token', data.access);
  return data.access;
}

let isRefreshing = false;
let refreshQueue = [];

async function request(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const wsId = getWorkspaceId();
  if (wsId) headers['X-Workspace-ID'] = wsId;

  const config = { method, headers };
  if (body !== undefined) config.body = JSON.stringify(body);

  let res = await fetch(`${BASE}${path}`, config);

  if (res.status === 401 && !opts._retry) {
    if (isRefreshing) {
      await new Promise((resolve) => refreshQueue.push(resolve));
      headers['Authorization'] = `Bearer ${getToken()}`;
      res = await fetch(`${BASE}${path}`, { ...config, headers });
    } else {
      isRefreshing = true;
      try {
        const newToken = await refreshToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        refreshQueue.forEach((r) => r());
        refreshQueue = [];
        res = await fetch(`${BASE}${path}`, { ...config, headers });
      } catch (e) {
        refreshQueue = [];
        clearTokens();
        window.location.href = '/login';
        throw e;
      } finally {
        isRefreshing = false;
      }
    }
  }

  if (!res.ok) {
    let errData = {};
    try { errData = await res.json(); } catch (_) {}
    const error = new Error(errData.detail || errData.error || errData.non_field_errors?.[0] || 'Request failed');
    error.status = res.status;
    error.data = errData;
    if (res.status === 403) {
      window.dispatchEvent(new CustomEvent('api:forbidden', { detail: { message: error.message } }));
    }
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

async function requestBlob(path, opts = {}) {
  const headers = { ...opts.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const wsId = getWorkspaceId();
  if (wsId) headers['X-Workspace-ID'] = wsId;

  let res = await fetch(`${BASE}${path}`, { method: 'GET', headers });

  if (res.status === 401 && !opts._retry) {
    if (isRefreshing) {
      await new Promise((resolve) => refreshQueue.push(resolve));
      headers['Authorization'] = `Bearer ${getToken()}`;
      res = await fetch(`${BASE}${path}`, { method: 'GET', headers });
    } else {
      isRefreshing = true;
      try {
        const newToken = await refreshToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        refreshQueue.forEach((r) => r());
        refreshQueue = [];
        res = await fetch(`${BASE}${path}`, { method: 'GET', headers });
      } catch (e) {
        refreshQueue = [];
        clearTokens();
        window.location.href = '/login';
        throw e;
      } finally {
        isRefreshing = false;
      }
    }
  }

  if (!res.ok) {
    let errData = {};
    try { errData = await res.json(); } catch (_) {}
    const error = new Error(errData.detail || errData.error || errData.non_field_errors?.[0] || 'Request failed');
    error.status = res.status;
    throw error;
  }

  return res.blob();
}

async function upload(path, formData, method = 'POST') {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const wsId = getWorkspaceId();
  if (wsId) headers['X-Workspace-ID'] = wsId;

  const res = await fetch(`${BASE}${path}`, { method, headers, body: formData });
  if (!res.ok) {
    let errData = {};
    try { errData = await res.json(); } catch (_) {}
    const error = new Error(errData.detail || 'Upload failed');
    error.status = res.status;
    error.data = errData;
    if (res.status === 403) {
      window.dispatchEvent(new CustomEvent('api:forbidden', { detail: { message: error.message } }));
    }
    throw error;
  }
  return res.json();
}

export const authApi = {
  login: (email, password, totp_code) => request('POST', '/auth/token/', { email, password, ...(totp_code ? { totp_code } : {}) }),
  googleLogin: (access_token, totp_code) => request('POST', '/auth/google/', { access_token, ...(totp_code ? { totp_code } : {}) }),
  googleLink: (access_token, password) => request('POST', '/auth/google/link/', { access_token, password }),
  register: (data) => request('POST', '/auth/register/', data),
  me: () => request('GET', '/users/me/'),
  updateMe: (data) => request('PATCH', '/users/me/', data),
  uploadAvatar: (formData) => upload('/users/me/', formData, 'PATCH'),
  changePassword: (current_password, new_password) => request('POST', '/users/me/change-password/', { current_password, new_password }),
  setup2FA: () => request('POST', '/users/me/2fa/setup/'),
  confirm2FA: (code) => request('POST', '/users/me/2fa/confirm/', { code }),
  disable2FA: (code) => request('POST', '/users/me/2fa/disable/', { code }),
};

export const workspaceApi = {
  list: () => request('GET', '/workspaces/'),
  create: (name) => request('POST', '/workspaces/', { name }),
  get: (id) => request('GET', `/workspaces/${id}/`),
  update: (id, data) => request('PATCH', `/workspaces/${id}/`, data),
  members: (id) => request('GET', `/workspaces/${id}/members/`),
  invites: (id) => request('GET', `/workspaces/${id}/invites/`),
  invite: (id, email, role) => request('POST', `/workspaces/${id}/invites/`, { email, role }),
};

export const creativesApi = {
  gallery: () => request('GET', '/creatives/gallery/'),
  generate: (data) => request('POST', '/creatives/generate/', data),
  jobs: () => request('GET', '/creatives/jobs/'),
  jobStatus: (id) => request('GET', `/creatives/jobs/${id}/`),
  makeVideo: (id, prompt, sourceImageUrl, duration) => request('POST', `/creatives/${id}/make-video/`, {
    prompt: prompt || 'Smooth cinematic motion, high quality',
    ...(sourceImageUrl ? { source_image_url: sourceImageUrl } : {}),
    duration: duration || 5,
  }),
  videoJobs: () => request('GET', '/creatives/video-jobs/'),
  videoJobStatus: (id) => request('GET', `/creatives/video-jobs/${id}/`),
  logoResults: () => request('GET', '/creatives/logo-results/'),
  logoResultsList: () => request('GET', '/creatives/logo-results/'),
  updateLogo: (id, data) => request('PATCH', `/creatives/${id}/logo/`, data),
  updateFeedback: (id, data) => request('PATCH', `/creatives/${id}/`, data),
  deleteCreative: (id) => request('DELETE', `/creatives/${id}/`),
  logoPlacementsForJob: (jobId, logoId) => request('GET', `/creatives/jobs/${jobId}/logo-placements/?logo_id=${logoId}`),
  logoEditorSave: (jobId, placements) => request('POST', `/creatives/jobs/${jobId}/logo-editor/save/`, { placements }),
};

export const brandKitApi = {
  getLogos: () => request('GET', '/brand-kit/logos/'),
  campaigns: () => request('GET', '/brand-kit/campaigns/'),
  createCampaign: (name) => request('POST', '/brand-kit/campaigns/', { name }),
  updateCampaign: (id, name) => request('PUT', `/brand-kit/campaigns/${id}/`, { name }),
  deleteCampaign: (id) => request('DELETE', `/brand-kit/campaigns/${id}/`),

  logos: () => request('GET', '/brand-kit/logos/'),
  uploadLogo: (formData) => upload('/brand-kit/logos/', formData),
  setPrimaryLogo: (id) => request('PATCH', `/brand-kit/logos/${id}/`, { is_primary: true }),
  deleteLogo: (id) => request('DELETE', `/brand-kit/logos/${id}/`),

  statics: () => request('GET', '/brand-kit/statics/'),
  uploadStatic: (formData) => upload('/brand-kit/statics/', formData),
  deleteStatic: (id) => request('DELETE', `/brand-kit/statics/${id}/`),

  disclaimers: () => request('GET', '/brand-kit/disclaimers/'),
  createDisclaimer: (text, category) => request('POST', '/brand-kit/disclaimers/', { text, category: category || 'General' }),
  deleteDisclaimer: (id) => request('DELETE', `/brand-kit/disclaimers/${id}/`),
  setDefaultDisclaimer: (id) => request('PATCH', `/brand-kit/disclaimers/${id}/`, { is_default: true }),
};

export const teamApi = {
  members: () => request('GET', '/team/members/'),
  removeMember: (id) => request('DELETE', `/team/members/${id}/remove/`),
  invites: () => request('GET', '/team/invites/'),
  invite: (email, role) => request('POST', '/team/invites/create/', { email, role }),
  cancelInvite: (id) => request('DELETE', `/team/invites/${id}/cancel/`),
  acceptInvite: (id) => request('POST', `/team/invites/${id}/accept/`),
  apiKeys: () => request('GET', '/team/api-keys/'),
  createApiKey: (name) => request('POST', '/team/api-keys/', { name }),
  deleteApiKey: (id) => request('DELETE', `/team/api-keys/${id}/`),
};

export const inviteApi = {
  getPublic: (token) => request('GET', `/workspaces/invites/${token}/`),
  accept: (token) => request('POST', `/workspaces/invites/${token}/accept/`),
  registerWithInvite: (data) => request('POST', '/auth/register-invite/', data),
};

export const billingApi = {
  plans: () => request('GET', '/billing/plans/'),
  currentPlan: () => request('GET', '/billing/plan/'),
  credits: () => request('GET', '/billing/credits/'),
  transactions: () => request('GET', '/billing/transactions/'),
  subscribe: (planId) => request('POST', '/billing/subscribe/', { plan_id: planId }),
};

export const activityApi = {
  events: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request('GET', `/activity/events/${qs}`);
  },
  analytics: () => request('GET', '/activity/analytics/'),
};

export const automationApi = {
  list: () => request('GET', '/automation/'),
  get: (id) => request('GET', `/automation/${id}/`),
  create: (data) => request('POST', '/automation/', data),
  update: (id, data) => request('PUT', `/automation/${id}/`, data),
  delete: (id) => request('DELETE', `/automation/${id}/`),
  toggle: (id) => request('POST', `/automation/${id}/toggle/`),
  runNow: (id) => request('POST', `/automation/${id}/run/`),
  runs: (id) => request('GET', `/automation/${id}/runs/`),
  runStatus: (runPk) => request('GET', `/automation/runs/${runPk}/status/`),
};


export const dataLabApi = {
  list: (statusFilter) => {
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    return request('GET', `/data-lab/ads/${qs}`);
  },
  sync: (account_id) => request('POST', '/data-lab/ads/sync/', { ...(account_id ? { account_id } : {}), date_preset: 'maximum' }),
  detail: (id) => request('GET', `/data-lab/ads/${id}/`),
  annotate: (id, data) => request('PATCH', `/data-lab/ads/${id}/`, data),
  export: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request('GET', `/data-lab/export/${qs}`);
  },
  exportBlob: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestBlob(`/data-lab/export/${qs}`);
  },
};

export const mgmtApi = {
  // Users
  users: () => request('GET', '/mgmt/users/'),
  createUser: (data) => request('POST', '/mgmt/users/', data),
  // Workspaces
  workspaces: () => request('GET', '/mgmt/workspaces/'),
  createWorkspace: (data) => request('POST', '/mgmt/workspaces/', data),
  workspaceDetail: (id) => request('GET', `/mgmt/workspaces/${id}/`),
  updateCredits: (id, credit_balance) => request('PATCH', `/mgmt/workspaces/${id}/credits/`, { credit_balance }),
  updateWorkspacePlan: (id, plan_tier) => request('PATCH', `/mgmt/workspaces/${id}/plan/`, { plan_tier }),
  // Plans
  plans: () => request('GET', '/mgmt/plans/'),
  createPlan: (data) => request('POST', '/mgmt/plans/', data),
  updatePlan: (id, data) => request('PATCH', `/mgmt/plans/${id}/`, data),
  deletePlan: (id) => request('DELETE', `/mgmt/plans/${id}/`),
  // Data Users
  dataUsers: () => request('GET', '/mgmt/data-users/'),
  updateDataUser: (id, is_data_user) => request('PATCH', `/mgmt/data-users/${id}/`, { is_data_user }),
  // Meta Ads
  metaAdsAccounts: () => request('GET', '/mgmt/meta-ads/accounts/'),
  metaAds: (date_preset = 'last_30d', account_id = '') => {
    const qs = new URLSearchParams({ date_preset });
    if (account_id) qs.set('account_id', account_id);
    return request('GET', `/mgmt/meta-ads/?${qs}`);
  },
  adCreative: (ad_id) => request('GET', `/mgmt/meta-ads/creative/${ad_id}/`),
};
