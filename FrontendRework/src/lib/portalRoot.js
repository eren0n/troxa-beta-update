// The dashboard's color-mode/UI-design attributes live on DashboardLayout's
// own root div (see DashboardLayout.jsx + ThemeContext.jsx), not <html> —
// deliberately, so marketing/login/signup pages stay dark regardless of the
// user's dashboard theme. CSS custom properties only inherit down the DOM
// tree, so anything portaled straight to document.body sits OUTSIDE that
// themed subtree and silently falls back to the default dark palette in
// light/custom mode. Portaling here instead keeps floating menus themed correctly.
export function getPortalRoot() {
  return document.querySelector('[data-color-mode]') || document.body;
}
