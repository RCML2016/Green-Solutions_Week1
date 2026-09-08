import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { WorkspaceProvider, useWorkspace } from "@/context/WorkspaceContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "sonner";

import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Platform from "@/pages/Platform";
import Solutions from "@/pages/Solutions";
import HowItWorks from "@/pages/HowItWorks";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import SiteDetail from "@/pages/SiteDetail";
import Team from "@/pages/Team";
import Reports from "@/pages/Reports";
import Alerts from "@/pages/Alerts";
import Snapshot from "@/pages/Snapshot";
import ExecutiveOverview from "@/pages/ExecutiveOverview";
import OperationsCenter from "@/pages/OperationsCenter";
import MyWork from "@/pages/MyWork";
import Administration from "@/pages/Administration";
import QaTracker from "@/pages/QaTracker";
import PerformanceAnalytics from "@/pages/PerformanceAnalytics";
import ClientPortal from "@/pages/ClientPortal";
import Assets from "@/pages/Assets";
import AiIntelligence from "@/pages/AiIntelligence";
import WorkOrders from "@/pages/WorkOrders";
import FleetAdmin from "@/pages/FleetAdmin";
import { landingFor } from "@/lib/roles";

function Protected({ children, allow }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gs-canvas text-[color:var(--ink)]">
        <div className="pulse-dot" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // Admin is a super-role — always allowed
  if (user.role === "admin") return children;
  // Solo-workspace roles are walled — only their landing page is reachable
  const soloLanding = {
    technician: "/my-work",
    performance_engineer: "/performance",
    client_viewer: "/client-portal",
  };
  if (soloLanding[user.role]) {
    const target = soloLanding[user.role];
    if (window.location.pathname !== target && !window.location.pathname.startsWith("/site/")) {
      return <Navigate to={target} replace />;
    }
    return children;
  }
  if (allow && !allow.includes(user.role)) {
    return <Navigate to={landingFor(user.role)} replace />;
  }
  return children;
}

function FeatureProtected({ feature, children }) {
  const { user } = useAuth();
  const { featureEnabled } = useWorkspace();
  if (user?.role !== "admin" && !featureEnabled(feature)) return <Navigate to={landingFor(user?.role)} replace />;
  return children;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WorkspaceProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/platform" element={<Platform />} />
            <Route path="/solutions" element={<Solutions />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />

            {/* Role-specific landings */}
            <Route path="/overview" element={
              <Protected allow={["executive", "asset_manager", "om_manager"]}><FeatureProtected feature="overview"><ExecutiveOverview /></FeatureProtected></Protected>
            } />
            <Route path="/dashboard" element={
              <Protected allow={["executive", "asset_manager", "om_manager", "performance_engineer"]}><FeatureProtected feature="portfolio"><Dashboard /></FeatureProtected></Protected>
            } />
            <Route path="/operations" element={
              <Protected allow={["om_manager", "asset_manager"]}><FeatureProtected feature="operations"><OperationsCenter /></FeatureProtected></Protected>
            } />
            <Route path="/my-work" element={
              <Protected allow={["technician", "om_manager"]}><FeatureProtected feature="my_work"><MyWork /></FeatureProtected></Protected>
            } />
            <Route path="/admin" element={
              <Protected allow={["admin"]}><Administration /></Protected>
            } />
            <Route path="/fleet-admin" element={
              <Protected allow={["admin", "asset_manager"]}><FleetAdmin /></Protected>
            } />
            <Route path="/qa-tracker" element={
              <Protected allow={["admin"]}><QaTracker /></Protected>
            } />
            <Route path="/performance" element={
              <Protected allow={["performance_engineer", "asset_manager"]}><FeatureProtected feature="performance"><PerformanceAnalytics /></FeatureProtected></Protected>
            } />
            <Route path="/client-portal" element={
              <Protected allow={["client_viewer"]}><FeatureProtected feature="client_portal"><ClientPortal /></FeatureProtected></Protected>
            } />
            <Route path="/assets" element={
              <Protected allow={["asset_manager", "om_manager", "performance_engineer"]}><FeatureProtected feature="assets"><Assets /></FeatureProtected></Protected>
            } />
            <Route path="/ai" element={
              <Protected allow={["executive", "asset_manager", "om_manager", "performance_engineer", "technician"]}><FeatureProtected feature="ai"><AiIntelligence /></FeatureProtected></Protected>
            } />
            <Route path="/work-orders" element={
              <Protected allow={["om_manager", "technician", "asset_manager"]}><FeatureProtected feature="work_orders"><WorkOrders /></FeatureProtected></Protected>
            } />

            <Route path="/reports" element={
              <Protected allow={["executive", "asset_manager", "om_manager"]}><FeatureProtected feature="reports"><Reports /></FeatureProtected></Protected>
            } />
            <Route path="/team" element={
              <Protected allow={["admin"]}><Team /></Protected>
            } />
            <Route path="/alerts" element={
              <Protected allow={["asset_manager", "om_manager", "technician"]}><Alerts /></Protected>
            } />
            <Route path="/site/:site_id" element={
              <Protected><SiteDetail /></Protected>
            } />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/s/:token" element={<Snapshot />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
        </WorkspaceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
