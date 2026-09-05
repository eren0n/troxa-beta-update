import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GenerationProvider } from './contexts/GenerationContext';

import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import DashboardHome from './pages/dashboard/DashboardHome';
import GenerateCreatives from './pages/dashboard/GenerateCreatives';
import GeneratedCreatives from './pages/dashboard/GeneratedCreatives';
import CreativeEditor from './pages/dashboard/CreativeEditor';
import BrandKit from './pages/dashboard/BrandKit';
import TeamWorkspace from './pages/dashboard/TeamWorkspace';
import BillingUsage from './pages/dashboard/BillingUsage';
import Activity from './pages/dashboard/Activity';
import Automation from './pages/dashboard/Automation';
import Profile from './pages/dashboard/Profile';
import Settings from './pages/dashboard/Settings';
import Integrations from './pages/dashboard/Integrations';
import LogoEditor from './pages/dashboard/LogoEditor';
import RMGSManagement from './pages/dashboard/RMGSManagement';
import ManageData from './pages/dashboard/ManageData';
import InviteAccept from './pages/InviteAccept';

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
      <div className="min-h-screen bg-[#05070a] flex items-center justify-center">
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
    <Router>
      <AuthProvider>
      <GenerationProvider>
        <div className="min-h-screen bg-[#07090f] text-white font-sans selection:bg-blue-500/25 selection:text-blue-200">
          <Routes>
            <Route path="/" element={<PublicShell><Home /></PublicShell>} />
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/signup" element={<GuestRoute><SignUp /></GuestRoute>} />

            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><DashboardHome /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/create" element={<ProtectedRoute><DashboardLayout><GenerateCreatives /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/creatives" element={<ProtectedRoute><DashboardLayout><GeneratedCreatives /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/editor/:id" element={<ProtectedRoute><DashboardLayout><CreativeEditor /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/brand-kit" element={<ProtectedRoute><DashboardLayout><BrandKit /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/team" element={<ProtectedRoute><DashboardLayout><TeamWorkspace /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/billing" element={<ProtectedRoute><DashboardLayout><BillingUsage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/activity" element={<ProtectedRoute><DashboardLayout><Activity /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/automation" element={<ProtectedRoute><DashboardLayout><Automation /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/profile" element={<ProtectedRoute><DashboardLayout><Profile /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute><DashboardLayout><Settings /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/integrations" element={<ProtectedRoute><DashboardLayout><Integrations /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/logo-editor/:jobId" element={<ProtectedRoute><LogoEditor /></ProtectedRoute>} />
            <Route path="/dashboard/mgmt" element={<ProtectedRoute><DashboardLayout><RMGSManagement /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/manage-data" element={<ProtectedRoute><DashboardLayout><ManageData /></DashboardLayout></ProtectedRoute>} />
            <Route path="/invite/:token" element={<InviteAccept />} />
          </Routes>
        </div>
      </GenerationProvider>
      </AuthProvider>
    </Router>
  );
}
