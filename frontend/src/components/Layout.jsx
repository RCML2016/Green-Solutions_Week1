import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#062015] text-[#eef1ec]">
      <Sidebar />
      <div className="lg:pl-[240px]">
        <TopBar />
        <main className="min-h-[calc(100vh-72px)]">
          <Outlet />
        </main>
        <footer className="border-t border-white/5 py-8 px-8 lg:px-14 text-xs text-white/40 flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono">© 2026 GREEN SOLUTIONS · AI OPERATING SYSTEM FOR RENEWABLE ENERGY</span>
          <span className="font-mono">v1.0 · LIVE</span>
        </footer>
      </div>
    </div>
  );
}
