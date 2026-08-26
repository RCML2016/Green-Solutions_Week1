import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function Layout() {
  return (
    <div className="min-h-screen gs-canvas text-[color:var(--ink)]">
      <Sidebar />
      <div className="lg:pl-[240px]">
        <TopBar />
        <main className="min-h-[calc(100vh-72px)]">
          <Outlet />
        </main>
        <footer className="border-t border-[color:var(--line)] py-8 px-8 lg:px-14 text-xs text-[color:var(--ink-3)] flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono">© 2026 GREEN SOLUTIONS · AI OPERATING SYSTEM FOR RENEWABLE ENERGY</span>
          <span className="font-mono">v1.0 · LIVE</span>
        </footer>
      </div>
    </div>
  );
}
