import { NavLink, Link, useNavigate } from "react-router-dom";
import { LogIn, LogOut, User, Menu } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

const TOP_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/platform", label: "Platform" },
  { to: "/solutions", label: "Solutions" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <header
      data-testid="app-topbar"
      className="sticky top-0 z-20 h-[72px] bg-white/70 backdrop-blur-md border-b border-[color:var(--line)] flex items-center justify-between px-6 lg:px-10"
    >
      <Link to="/" className="lg:hidden flex items-center gap-2" data-testid="topbar-logo">
        <div className="flex items-end gap-[3px] h-5">
          <span className="w-1.5 h-2 rounded-sm" style={{ background: "var(--brand)" }} />
          <span className="w-1.5 h-3.5 rounded-sm" style={{ background: "var(--brand-2)" }} />
          <span className="w-1.5 h-5 rounded-sm" style={{ background: "var(--brand-3)" }} />
        </div>
        <div className="font-display text-sm">
          <span className="text-[color:var(--ink)]">GREEN</span>
          <span className="text-[color:var(--brand-3)] ml-1">SOLUTIONS</span>
        </div>
      </Link>

      <nav className="hidden md:flex items-center gap-8">
        {TOP_LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            data-testid={`topbar-link-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
            className={({ isActive }) => `topbar-link ${isActive ? "active" : ""}`}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-[color:var(--ink-3)]">
          <span className="pulse-dot" />
          LIVE
        </div>
        {user ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="hidden sm:flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-sm text-[color:var(--ink-2)] hover:border-[color:var(--brand)] hover:text-[color:var(--brand-3)] transition"
              data-testid="topbar-dashboard-btn"
            >
              <User size={14} /> {user.name?.split(" ")[0] || "You"}
            </button>
            <button
              onClick={logout}
              className="rounded-full p-2 border border-[color:var(--line)] bg-white text-[color:var(--ink-2)] hover:border-[color:var(--ink)] transition"
              data-testid="topbar-logout-btn"
              aria-label="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <>
            <Link
              to="/login"
              data-testid="topbar-login-btn"
              className="rounded-full px-4 py-2 text-sm text-[color:var(--ink-2)] hover:text-[color:var(--ink)] transition flex items-center gap-2 border border-[color:var(--line)] hover:border-[color:var(--ink)] bg-white"
            >
              <LogIn size={14} /> Login
            </Link>
            <Link
              to="/register"
              data-testid="topbar-register-btn"
              className="hidden sm:inline-flex gs-btn-primary text-sm py-2 px-4"
            >
              Get Started
            </Link>
          </>
        )}
        <button
          className="md:hidden rounded-full p-2 border border-[color:var(--line)] bg-white"
          onClick={() => setOpen((v) => !v)}
          data-testid="topbar-menu-toggle"
          aria-label="Menu"
        >
          <Menu size={16} />
        </button>
      </div>

      {open && (
        <div className="md:hidden absolute top-[72px] left-0 right-0 bg-white border-b border-[color:var(--line)] p-4 space-y-2">
          {TOP_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
}
