import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GenerationProvider } from './contexts/GenerationContext';
import { BrandIdentityProvider } from './contexts/BrandIdentityContext';
import { ThemeProvider } from './contexts/ThemeContext';

import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import InviteAccept from './pages/InviteAccept';
import { dashboardRouteImports } from './lib/dashboardRoutes';

// Dashboard pages are route-split so the ~350KB shared bundle isn't paid for
// by visitors who only ever see the marketing site or login screen — each
// chunk loads on first visit to that route instead of all up front. The
// import functions live in dashboardRoutes.js so Sidebar/BottomDock can
// prefetch a chunk on hover, ahead of the actual click.
const DashboardHome = lazy(dashboardRouteImports['/dashboard']);
const GenerateCreatives = lazy(dashboardRouteImports['/dashboard/create']);
const GenerateCreativesV2 = lazy(dashboardRouteImports['/dashboard/create-v2']);
const PromptStudio = lazy(dashboardRouteImports['/dashboard/prompt-studio']);
const MakeVideo = lazy(dashboardRouteImports['/dashboard/make-video']);
const EditCreative = lazy(dashboardRouteImports['/dashboard/editor']);
const GeneratedCreatives = lazy(dashboardRouteImports['/dashboard/gallery']);
const CreativeEditor = lazy(() => import('./pages/dashboard/CreativeEditor'));
const BrandKit = lazy(dashboardRouteImports['/dashboard/brand-kit']);
const WorkspaceManagement = lazy(dashboardRouteImports['/dashboard/workspace']);
const Automation = lazy(dashboardRouteImports['/dashboard/automation']);
const Profile = lazy(dashboardRouteImports['/dashboard/profile']);
const Settings = lazy(dashboardRouteImports['/dashboard/settings']);
const LogoEditor = lazy(() => import('./pages/dashboard/LogoEditor'));
const RMGSManagement = lazy(dashboardRouteImports['/dashboard/mgmt']);

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

function PublicShell({ children }) {
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
        <GenerationProvider>
        <BrandIdentityProvider>
          <div className="min-h-screen font-sans" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<PublicShell><Home /></PublicShell>} />
                <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
                <Route path="/signup" element={<GuestRoute><SignUp /></GuestRoute>} />

                {/* Nested under one DashboardLayout instance so the chrome (sidebar,
                    header, animated background) mounts once and survives tab
                    switches — only the Outlet's matched page suspends, and it
                    does so behind a small in-page skeleton instead of a
                    full-screen fallback that would wipe out the navbar. */}
                <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                  <Route index element={<DashboardHome />} />
                  <Route path="create" element={<Navigate to="/dashboard/create-v2" replace />} />
                  <Route path="create-v2" element={<GenerateCreativesV2 />} />
                  <Route path="prompt-studio" element={<PromptStudio />} />
                  <Route path="make-video" element={<MakeVideo />} />
                  <Route path="editor" element={<EditCreative />} />
                  <Route path="gallery" element={<GeneratedCreatives />} />
                  <Route path="brand-kit" element={<BrandKit />} />
                  <Route path="workspace" element={<WorkspaceManagement />} />
                  <Route path="automation" element={<Automation />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="mgmt" element={<RMGSManagement />} />
                  {/* Old standalone routes — Team/Billing/Integrations merged into
                      Workspace Management; Activity was removed outright; Creatives
                      renamed to Gallery. */}
                  <Route path="creatives" element={<Navigate to="/dashboard/gallery" replace />} />
                  <Route path="team" element={<Navigate to="/dashboard/workspace?tab=team" replace />} />
                  <Route path="billing" element={<Navigate to="/dashboard/workspace?tab=billing" replace />} />
                  <Route path="integrations" element={<Navigate to="/dashboard/workspace?tab=integrations" replace />} />
                  <Route path="activity" element={<Navigate to="/dashboard" replace />} />
                </Route>
                <Route path="/dashboard/editor/:id" element={<ProtectedRoute><CreativeEditor /></ProtectedRoute>} />
                <Route path="/dashboard/logo-editor/:jobId" element={<ProtectedRoute><LogoEditor /></ProtectedRoute>} />
                <Route path="/invite/:token" element={<InviteAccept />} />
              </Routes>
            </Suspense>
          </div>
        </BrandIdentityProvider>
        </GenerationProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}
