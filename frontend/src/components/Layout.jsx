import { Outlet, Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useAuth } from "@/context/AuthContext";
import WorkspaceBanner from "./WorkspaceBanner";
import { useWorkspace } from "@/context/WorkspaceContext";
import DemoScenarioGuide from "./DemoScenarioGuide";

const MODE_PILL = {
  demo: "bg-amber-50 text-amber-900 border-amber-200",
  pilot: "bg-blue-50 text-blue-900 border-blue-200",
  production: "bg-emerald-50 text-emerald-900 border-emerald-200",
};

export default function Layout() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  return (
    <div className="min-h-screen gs-canvas text-[color:var(--ink)]">
      <Sidebar />
      <div className={user ? "lg:pl-[240px]" : ""}>
        <TopBar />
        {user && <WorkspaceBanner />}
        {user && <DemoScenarioGuide />}
        <main className="min-h-[calc(100vh-72px)]">
          <Outlet />
        </main>
        <footer data-testid="site-footer" className="border-t border-[color:var(--line)] py-6 px-8 lg:px-14 text-[color:var(--ink-3)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-[11px] leading-relaxed text-center md:text-left" data-testid="footer-copyright">
              © {new Date().getFullYear()} AssetNova Energy. All rights reserved.{" "}
              <span className="block md:inline md:ml-1.5 mt-0.5 md:mt-0 opacity-80">
                AssetNova™ is a product of AssetNova Energy™
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 md:gap-4">
              <nav className="flex flex-wrap items-center justify-center gap-3 md:gap-4 text-[11px]" aria-label="Legal">
                <Link to="/privacy-policy" data-testid="footer-link-privacy" className="hover:text-[color:var(--brand-3)] transition">
                  Privacy Policy
                </Link>
                <Link to="/terms-of-use" data-testid="footer-link-terms" className="hover:text-[color:var(--brand-3)] transition">
                  Terms of Use
                </Link>
                <Link to="/trademark-notice" data-testid="footer-link-trademark" className="hover:text-[color:var(--brand-3)] transition">
                  Trademark Notice
                </Link>
                <Link to="/contact" data-testid="footer-link-contact" className="hover:text-[color:var(--brand-3)] transition">
                  Contact
                </Link>
              </nav>
              <span
                data-testid="footer-version"
                className={`inline-flex items-center gap-1.5 font-mono text-[9px] border rounded-full px-2 py-0.5 whitespace-nowrap transition-colors ${
                  MODE_PILL[workspace?.mode] || "border-[color:var(--line)] bg-white text-[color:var(--ink-3)]"
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full pulse-dot"
                  style={{ background: workspace?.mode === "demo" ? "#f59e0b" : workspace?.mode === "pilot" ? "#3b82f6" : workspace?.mode === "production" ? "#10b981" : undefined }}
                />
                v1.0 · {workspace?.mode ? workspace.mode.charAt(0).toUpperCase() + workspace.mode.slice(1) : "Ready"}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
