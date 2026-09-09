import { Outlet, Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useAuth } from "@/context/AuthContext";
import WorkspaceBanner from "./WorkspaceBanner";
import { useWorkspace } from "@/context/WorkspaceContext";
import DemoScenarioGuide from "./DemoScenarioGuide";

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
        <footer data-testid="site-footer" className="border-t border-[color:var(--line)] py-8 px-8 lg:px-14 text-xs text-[color:var(--ink-3)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="font-mono leading-relaxed text-center md:text-left" data-testid="footer-copyright">
              © {new Date().getFullYear()} AssetNova Energy. All rights reserved.{" "}
              <span className="block md:inline md:ml-2 mt-0.5 md:mt-0">
                AssetNova™ is a product of AssetNova Energy™
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-4 md:gap-5">
              <nav className="flex flex-wrap items-center justify-center gap-4 md:gap-5 font-mono" aria-label="Legal">
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
                className="inline-flex items-center gap-1.5 font-mono text-[10px] border border-[color:var(--line)] bg-white rounded-full px-2.5 py-1 whitespace-nowrap"
              >
                <span className="pulse-dot" /> v1.0 · {workspace?.mode?.toUpperCase() || "READY"}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
