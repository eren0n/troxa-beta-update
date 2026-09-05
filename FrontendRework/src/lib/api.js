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

async function requestBlob(path) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const wsId = getWorkspaceId();
  if (wsId) headers['X-Workspace-ID'] = wsId;
  const res = await fetch(`${BASE}${path}`, { method: 'GET', headers });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

async function upload(path, formData, method = 'POST', _retry = false) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const wsId = getWorkspaceId();
  if (wsId) headers['X-Workspace-ID'] = wsId;

  let res = await fetch(`${BASE}${path}`, { method, headers, body: formData });

  if (res.status === 401 && !_retry) {
    if (isRefreshing) {
      await new Promise((resolve) => refreshQueue.push(resolve));
      headers['Authorization'] = `Bearer ${getToken()}`;
      res = await fetch(`${BASE}${path}`, { method, headers, body: formData });
    } else {
      isRefreshing = true;
      try {
        const newToken = await refreshToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        refreshQueue.forEach((r) => r());
        refreshQueue = [];
        res = await fetch(`${BASE}${path}`, { method, headers, body: formData });
      } catch (e) {
        refreshQueue = [];
        clearTokens();
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw new Error('Session expired');
      } finally {
        isRefreshing = false;
      }
    }
  }

  if (!res.ok) {
    let errData = {};
    try { errData = await res.json(); } catch (_) {}
    const error = new Error(errData.detail || errData.error || 'Upload failed');
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
};

export const creativesApi = {
  gallery: (params) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
    ).toString() : '';
    return request('GET', `/creatives/gallery/${qs}`);
  },
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
  getCreative: (id) => request('GET', `/creatives/${id}/`),
  updateFeedback: (id, data) => request('PATCH', `/creatives/${id}/`, data),
  updateCreative: (id, data) => request('PATCH', `/creatives/${id}/`, data),
  deleteCreative: (id) => request('DELETE', `/creatives/${id}/`),
  logoPlacementsForJob: (jobId, logoId) => request('GET', `/creatives/jobs/${jobId}/logo-placements/?logo_id=${logoId}`),
  logoEditorSave: (jobId, placements) => request('POST', `/creatives/jobs/${jobId}/logo-editor/save/`, { placements }),
  aiEdit: (id, data) => request('POST', `/creatives/${id}/ai-edit/`, data),
  saveCanvas: (data) => request('POST', '/creatives/save-canvas/', data),
  logoPlacement: (id, logoId) => request('GET', `/creatives/${id}/logo-placement/?logo_id=${logoId}`),
  eraseCreative: (id, data) => request('POST', `/creatives/${id}/erase/`, data),
  upload: (formData) => upload('/creatives/upload/', formData),
  tags: () => request('GET', '/creatives/tags/'),
  contributors: () => request('GET', '/creatives/contributors/'),
  createTag: (name, color) => request('POST', '/creatives/tags/', color ? { name, color } : { name }),
  assignTags: (id, tagIds) => request('PATCH', `/creatives/${id}/tags/`, { tag_ids: tagIds }),
};

export const brandKitApi = {
  getLogos: () => request('GET', '/brand-kit/logos/'),
  campaigns: () => request('GET', '/brand-kit/campaigns/'),
  createCampaign: (name, extra) => request('POST', '/brand-kit/campaigns/', { name, ...extra }),
  updateCampaign: (id, data) => request('PATCH', `/brand-kit/campaigns/${id}/`, data),
  deleteCampaign: (id) => request('DELETE', `/brand-kit/campaigns/${id}/`),

  logos: () => request('GET', '/brand-kit/logos/'),
  // Paginated variant for the horizontal gallery — plain logos() above is left untouched so
  // every other consumer (GenerateCreatives, PromptStudio) keeps getting the full list it expects.
  logosPage: (limit, offset) => request('GET', `/brand-kit/logos/?limit=${limit}&offset=${offset}`),
  uploadLogo: (formData) => upload('/brand-kit/logos/', formData),
  setPrimaryLogo: (id) => request('PATCH', `/brand-kit/logos/${id}/`, { is_primary: true }),
  deleteLogo: (id) => request('DELETE', `/brand-kit/logos/${id}/`),

  ctas: () => request('GET', '/brand-kit/ctas/'),
  uploadCta: (formData) => upload('/brand-kit/ctas/', formData),
  setPrimaryCta: (id) => request('PATCH', `/brand-kit/ctas/${id}/`, { is_primary: true }),
  updateCta: (id, data) => request('PATCH', `/brand-kit/ctas/${id}/`, data),
  deleteCta: (id) => request('DELETE', `/brand-kit/ctas/${id}/`),

  promos: () => request('GET', '/brand-kit/promos/'),
  uploadPromo: (formData) => upload('/brand-kit/promos/', formData),
  setPrimaryPromo: (id) => request('PATCH', `/brand-kit/promos/${id}/`, { is_primary: true }),
  updatePromo: (id, data) => request('PATCH', `/brand-kit/promos/${id}/`, data),
  deletePromo: (id) => request('DELETE', `/brand-kit/promos/${id}/`),

  statics: () => request('GET', '/brand-kit/statics/'),
  uploadStatic: (formData) => upload('/brand-kit/statics/', formData),
  generateStatic: (formData) => upload('/brand-kit/statics/generate/', formData),
  deleteStatic: (id) => request('DELETE', `/brand-kit/statics/${id}/`),
  environments: () => request('GET', '/brand-kit/statics/?category=environment'),
  uploadEnvironment: (formData) => upload('/brand-kit/statics/', formData),
  studioGenerate: (data) => request('POST', '/brand-kit/studio/generate/', data),
  studioStatus: (jobId) => request('GET', `/brand-kit/studio/status/${jobId}/`),

  palettePresets: () => request('GET', '/brand-kit/palette-presets/'),
  createPalettePreset: (data) => request('POST', '/brand-kit/palette-presets/', data),
  updatePalettePreset: (id, data) => request('PATCH', `/brand-kit/palette-presets/${id}/`, data),
  deletePalettePreset: (id) => request('DELETE', `/brand-kit/palette-presets/${id}/`),

  typographyPresets: () => request('GET', '/brand-kit/typography-presets/'),
  createTypographyPreset: (data) => request('POST', '/brand-kit/typography-presets/', data),
  updateTypographyPreset: (id, data) => request('PATCH', `/brand-kit/typography-presets/${id}/`, data),
  deleteTypographyPreset: (id) => request('DELETE', `/brand-kit/typography-presets/${id}/`),

  disclaimers: () => request('GET', '/brand-kit/disclaimers/'),
  createDisclaimer: (text, category) => request('POST', '/brand-kit/disclaimers/', { text, category: category || 'General' }),
  deleteDisclaimer: (id) => request('DELETE', `/brand-kit/disclaimers/${id}/`),
  setDefaultDisclaimer: (id) => request('PATCH', `/brand-kit/disclaimers/${id}/`, { is_default: true }),

  characters: () => request('GET', '/brand-kit/characters/'),
  charactersPage: (limit, offset) => request('GET', `/brand-kit/characters/?limit=${limit}&offset=${offset}`),
  createCharacter: (name, description) => request('POST', '/brand-kit/characters/', { name, description }),
  updateCharacter: (id, data) => request('PATCH', `/brand-kit/characters/${id}/`, data),
  deleteCharacter: (id) => request('DELETE', `/brand-kit/characters/${id}/`),
  uploadCharacterImage: (id, formData) => upload(`/brand-kit/characters/${id}/images/`, formData),
  deleteCharacterImage: (charId, imgId) => request('DELETE', `/brand-kit/characters/${charId}/images/${imgId}/`),
  generateCharacter: (formData) => upload('/brand-kit/characters/generate/', formData),

  forbiddenKeywords: () => request('GET', '/brand-kit/forbidden-keywords/'),
  addForbiddenKeyword: (keyword) => request('POST', '/brand-kit/forbidden-keywords/', { keyword }),
  deleteForbiddenKeyword: (id) => request('DELETE', `/brand-kit/forbidden-keywords/${id}/`),
};

export const teamApi = {
  members: () => request('GET', '/team/members/'),
  updateMemberRole: (id, role) => request('PATCH', `/team/members/${id}/`, { role }),
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
  currentPlan: () => request('GET', '/billing/plan/'),
  credits: () => request('GET', '/billing/credits/'),
  transactions: () => request('GET', '/billing/transactions/'),
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
  update: (id, data) => request('PATCH', `/automation/${id}/`, data),
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
  exportBlob: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestBlob(`/data-lab/export/${qs}`);
  },
  exportZipBlob: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestBlob(`/data-lab/export/zip/${qs}`);
  },
};

export const slackApi = {
  status:   ()     => request('GET',    '/slack/status/'),
  channels: ()     => request('GET',    '/slack/channels/'),
  post:     (data) => request('POST',   '/slack/post/', data),
};

export const metaApi = {
  install:     ()           => request('GET', '/meta/install/'),
  status:      ()           => request('GET', '/meta/status/'),
  disconnect:  ()           => request('DELETE', '/meta/disconnect/'),
  accounts:    ()           => request('GET', '/meta/accounts/'),
  setAccount:  (data)       => request('PATCH', '/meta/accounts/', data),
  pages:       ()           => request('GET', '/meta/pages/'),
  setPage:     (data)       => request('PATCH', '/meta/pages/', data),
  campaigns:   ()           => request('GET', '/meta/campaigns/'),
  adsets:      (campaign_id) => request('GET', `/meta/adsets/?campaign_id=${campaign_id}`),
  postCreative: (data)      => request('POST', '/meta/post/', data),
  metrics:     (creative_id) => request('GET', `/meta/metrics/${creative_id}/`),
};

export const mgmtApi = {
  // Permissions
  myPermissions: () => request('GET', '/mgmt/my-permissions/'),
  permissions: () => request('GET', '/mgmt/permissions/'),
  updatePermission: (userId, tabs) => request('PATCH', `/mgmt/permissions/${userId}/`, { tabs }),
  // Users
  users: () => request('GET', '/mgmt/users/'),
  createUser: (data) => request('POST', '/mgmt/users/', data),
  updateUser: (id, data) => request('PATCH', `/mgmt/users/${id}/`, data),
  // Workspaces
  workspaces: () => request('GET', '/mgmt/workspaces/'),
  createWorkspace: (data) => request('POST', '/mgmt/workspaces/', data),
  workspaceDetail: (id) => request('GET', `/mgmt/workspaces/${id}/`),
  updateCredits: (id, credit_bonus) => request('PATCH', `/mgmt/workspaces/${id}/credits/`, { credit_bonus }),
  updateWorkspacePlan: (id, plan_tier) => request('PATCH', `/mgmt/workspaces/${id}/plan/`, { plan_tier }),
  updateWorkspaceCode: (id, code) => request('PATCH', `/mgmt/workspaces/${id}/code/`, { code }),
  addWorkspaceMember: (wsId, email, role) => request('POST', `/mgmt/workspaces/${wsId}/members/`, { email, role }),
  removeWorkspaceMember: (wsId, memberPk) => request('DELETE', `/mgmt/workspaces/${wsId}/members/${memberPk}/`),
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
};

export const fingerprintApi = {
  status:   () => request('GET',  '/fingerprint/status/'),
  merge:    () => request('POST', '/fingerprint/merge/'),
  recreate: () => request('POST', '/fingerprint/recreate/'),

  // Campaign Intelligence
  campaignIntel   : (id) => request('GET',  `/fingerprint/campaign/${id}/intel/`),
  campaignResearch: (id) => request('POST', `/fingerprint/campaign/${id}/research/`),
  campaignBriefs  : (id) => request('GET',  `/fingerprint/campaign/${id}/briefs/`),
  campaignRebriefs: (id) => request('POST', `/fingerprint/campaign/${id}/briefs/`),

  // Workspace Trend Scout (campaign-independent)
  trendsGet:     () => request('GET',  '/fingerprint/trends/'),
  trendsRefresh: () => request('POST', '/fingerprint/trends/'),

  // Prompt Architect — DNA × seed → master prompt (~3-5s, synchronous)
  buildPrompt: (seed, aspectRatio, useFingerprint = true) => request('POST', '/fingerprint/build-prompt/', {
    seed, aspect_ratio: aspectRatio, use_fingerprint: useFingerprint,
  }),
};
