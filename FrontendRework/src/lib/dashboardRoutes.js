// Single source of truth for /dashboard/* lazy imports, so App.jsx builds its
// lazy() components from it and nav components (Sidebar, BottomDock) can
// warm a chunk on hover — by the time the click lands, the fetch/parse the
// tab switch would otherwise wait on has already started or finished.
export const dashboardRouteImports = {
  '/dashboard':                () => import('../pages/dashboard/DashboardHome'),
  '/dashboard/create':         () => import('../pages/dashboard/GenerateCreatives'),
  '/dashboard/create-v2':      () => import('../pages/dashboard/GenerateCreativesV2'),
  '/dashboard/prompt-studio':  () => import('../pages/dashboard/PromptStudio'),
  '/dashboard/make-video':     () => import('../pages/dashboard/MakeVideo'),
  '/dashboard/editor':         () => import('../pages/dashboard/EditCreative'),
  '/dashboard/gallery':        () => import('../pages/dashboard/GeneratedCreatives'),
  '/dashboard/brand-kit':      () => import('../pages/dashboard/BrandKit'),
  '/dashboard/workspace':      () => import('../pages/dashboard/WorkspaceManagement'),
  '/dashboard/automation':     () => import('../pages/dashboard/Automation'),
  '/dashboard/profile':        () => import('../pages/dashboard/Profile'),
  '/dashboard/settings':       () => import('../pages/dashboard/Settings'),
  '/dashboard/mgmt':           () => import('../pages/dashboard/RMGSManagement'),
};

const preloaded = new Set();

export function preloadDashboardRoute(path) {
  if (preloaded.has(path)) return;
  const importFn = dashboardRouteImports[path];
  if (!importFn) return;
  preloaded.add(path);
  importFn().catch(() => preloaded.delete(path));
}
