import { NavLink, Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ROLES, visibleAppItems } from "@/lib/roles";

/** App sidebar — visible ONLY to logged-in users. Renders the 8-item app nav
 *  (or the single-page walled garden for technician / perf / client). */
export default function Sidebar() {
  const { user } = useAuth();
  if (!user) return null;

  const items = visibleAppItems(user);
  const roleMeta = ROLES[user.role];

  return (
    <aside
      data-testid="app-sidebar"
      className="hidden lg:flex fixed inset-y-0 left-0 w-[240px] flex-col border-r border-[color:var(--line)] bg-[color:var(--bg-2)] z-30"
    >
      <Link
        to={items[0]?.to || "/dashboard"}
        className="flex items-center gap-3 px-6 h-[72px] border-b border-[color:var(--line)]"
        data-testid="sidebar-logo"
      >
        <div className="flex items-end gap-[3px] h-5">
          <span className="w-1.5 h-2 rounded-sm" style={{ background: "var(--brand)" }} />
          <span className="w-1.5 h-3.5 rounded-sm" style={{ background: "var(--brand-2)" }} />
          <span className="w-1.5 h-5 rounded-sm" style={{ background: "var(--brand-3)" }} />
        </div>
        <div className="leading-none">
          <div className="font-display text-[13px] tracking-wide text-[color:var(--ink)]">ASSET</div>
          <div className="font-display text-[13px] tracking-wide text-[color:var(--brand-3)]">NOVA</div>
        </div>
      </Link>

      {/* Role badge */}
      {roleMeta && (
        <div className="px-4 pt-4" data-testid="sidebar-role-badge">
          <div className="rounded-xl border border-[color:var(--line-2)] bg-white/60 px-3 py-2 flex items-center gap-2">
            <roleMeta.icon size={14} className="text-[color:var(--brand-3)]" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono text-[color:var(--ink-3)]">SIGNED IN AS</div>
              <div className="text-xs font-medium text-[color:var(--ink)] truncate">{roleMeta.label}</div>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-6 px-4">
        <div className="px-3 mb-2 font-mono text-[10px] tracking-[0.2em] text-[color:var(--ink-3)]">
          WORKSPACE
        </div>
        <div className="space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={`sidebar-link-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              <item.icon size={16} strokeWidth={1.8} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="p-4 border-t border-[color:var(--line)]">
        <a
          href="https://www.assetnova.com/"
          target="_blank"
          rel="noreferrer"
          data-testid="sidebar-launch-platform"
          className="gs-btn-primary w-full justify-between text-sm"
        >
          Launch AI Platform
          <ArrowUpRight size={16} />
        </a>
        <div className="mt-4 flex items-center gap-2 text-[11px] font-mono text-[color:var(--ink-3)]">
          <span className="pulse-dot" />
          <span>LIVE · INTELLIGENCE ONLINE</span>
        </div>
      </div>
    </aside>
  );
}
