import { NavLink, Link } from "react-router-dom";
import {
  Home,
  Layers,
  Cpu,
  Workflow,
  Users,
  MessageSquare,
  LayoutDashboard,
  ArrowUpRight,
  UserPlus,
  Mail,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/", label: "Overview", icon: Home, section: "PLATFORM" },
  { to: "/platform", label: "Platform", icon: Layers, section: "PLATFORM" },
  { to: "/solutions", label: "Solutions", icon: Cpu, section: "PLATFORM" },
  { to: "/how-it-works", label: "How It Works", icon: Workflow, section: "PLATFORM" },
  { to: "/dashboard", label: "Live Dashboard", icon: LayoutDashboard, section: "OPERATIONS", protected: true },
  { to: "/reports", label: "Report Scheduler", icon: Mail, section: "OPERATIONS", protected: true },
  { to: "/team", label: "Team", icon: UserPlus, section: "OPERATIONS", adminOnly: true },
  { to: "/about", label: "About", icon: Users, section: "COMPANY" },
  { to: "/contact", label: "Contact", icon: MessageSquare, section: "COMPANY" },
];

export default function Sidebar() {
  const { user } = useAuth();
  const sections = ["PLATFORM", "OPERATIONS", "COMPANY"];

  return (
    <aside
      data-testid="app-sidebar"
      className="hidden lg:flex fixed inset-y-0 left-0 w-[240px] flex-col border-r border-white/5 bg-[#04180f] z-30"
    >
      <Link
        to="/"
        className="flex items-center gap-3 px-6 h-[72px] border-b border-white/5"
        data-testid="sidebar-logo"
      >
        <div className="flex items-end gap-[3px] h-5">
          <span className="w-1.5 h-2 bg-[#22d17a] rounded-sm" />
          <span className="w-1.5 h-3.5 bg-[#22d17a] rounded-sm" />
          <span className="w-1.5 h-5 bg-[#22d17a] rounded-sm" />
        </div>
        <div className="leading-none">
          <div className="font-display text-[13px] tracking-wide text-white/90">GREEN</div>
          <div className="font-display text-[13px] tracking-wide text-[#22d17a]">SOLUTIONS</div>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
        {sections.map((sec) => (
          <div key={sec}>
            <div className="px-3 mb-2 font-mono text-[10px] tracking-[0.2em] text-white/35">
              {sec}
            </div>
            <div className="space-y-1">
              {NAV.filter((n) => n.section === sec).filter((n) => !n.adminOnly || user?.role === "admin").map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  data-testid={`sidebar-link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
                >
                  <item.icon size={16} strokeWidth={1.8} />
                  <span>{item.label}</span>
                  {item.protected && !user && (
                    <span className="ml-auto text-[9px] font-mono text-white/40">AUTH</span>
                  )}
                  {item.adminOnly && (
                    <span className="ml-auto text-[9px] font-mono text-[#6dfcb2]/70">ADMIN</span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5">
        <a
          href="https://green-solutions-ai.streamlit.app/"
          target="_blank"
          rel="noreferrer"
          data-testid="sidebar-launch-platform"
          className="flex items-center justify-between gap-2 rounded-xl bg-[#22d17a] hover:bg-[#6dfcb2] text-[#062015] px-4 py-3 text-sm font-semibold transition"
        >
          Launch AI Platform
          <ArrowUpRight size={16} />
        </a>
        <div className="mt-4 flex items-center gap-2 text-[11px] font-mono text-white/40">
          <span className="pulse-dot" />
          <span>LIVE · INTELLIGENCE ONLINE</span>
        </div>
      </div>
    </aside>
  );
}
