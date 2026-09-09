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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="font-mono leading-relaxed" data-testid="footer-copyright">
              © {new Date().getFullYear()} AssetNova Energy. All rights reserved.{" "}
              <span className="block sm:inline sm:ml-2 mt-0.5 sm:mt-0">
                AssetNova™ is a product of AssetNova Energy™
              </span>
            </div>
            <nav className="flex items-center gap-5 font-mono" aria-label="Legal">
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
          </div>
          <div className="mt-3 font-mono text-[color:var(--ink-3)]" data-testid="footer-version">
            v1.0 · {workspace?.mode?.toUpperCase() || "READY"}
          </div>
        </footer>
      </div>
    </div>
  );
}
