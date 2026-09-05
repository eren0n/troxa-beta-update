export function creativeProxyUrl(id) {
  const token = localStorage.getItem('access_token');
  const wsId = localStorage.getItem('active_workspace_id');
  return `/api/creatives/${id}/image/?token=${token}&workspace_id=${wsId}`;
}
