import { NavLink, Link, useNavigate } from "react-router-dom";
import { LogIn, LogOut, User, Menu, Sun, Moon, KeyRound, ChevronDown, Check, PhoneCall } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ROLES, landingFor, MARKETING_NAV } from "@/lib/roles";
import { toast } from "sonner";
import PasswordChangeModal from "./PasswordChangeModal";
import BookDemoModal from "./BookDemoModal";

const TOP_LINKS = MARKETING_NAV.map((l) => ({ to: l.to, label: l.label, end: l.end }));

export default function TopBar() {
  const { user, logout, switchWorkspace } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [showBookDemo, setShowBookDemo] = useState(false);
  const [myRoles, setMyRoles] = useState([]);
  const profileRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!user) { setMyRoles([]); return; }
    api.get("/rbac/my-roles").then(({ data }) => setMyRoles(data.roles || [])).catch(() => setMyRoles([]));
  }, [user?.role, user?.id]);

  const doSwitch = async (role) => {
    setProfileOpen(false);
    const res = await switchWorkspace(role);
    if (res.ok) {
      toast.success(`Switched to ${ROLES[role]?.label || role}`);
      navigate(landingFor(role));
    } else {
      toast.error(res.error || "Switch failed");
    }
  };

  return (
    <>
      <header
        data-testid="app-topbar"
        className="sticky top-0 z-20 h-[72px] bg-[color:var(--bg-2)]/70 backdrop-blur-md border-b border-[color:var(--line)] flex items-center justify-between px-6 lg:px-10"
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
          {!user && TOP_LINKS.map((l) => (
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

          <button
            onClick={toggle}
            data-testid="theme-toggle"
            aria-label="Toggle theme"
            title={theme === "light" ? "Switch to dark" : "Switch to light"}
            className="rounded-full p-2 border border-[color:var(--line)] bg-[color:var(--bg-2)] text-[color:var(--ink-2)] hover:border-[color:var(--brand)] hover:text-[color:var(--brand-3)] transition"
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {user ? (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((v) => !v)}
                data-testid="topbar-profile-btn"
                className="flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-2)] pl-2 pr-3 py-1.5 text-sm text-[color:var(--ink-2)] hover:border-[color:var(--brand)] hover:text-[color:var(--brand-3)] transition"
              >
                <span className="w-6 h-6 rounded-full bg-[color:var(--brand-tint)] text-[color:var(--brand-3)] flex items-center justify-center text-[11px] font-semibold">
                  {user.name?.[0]?.toUpperCase() || "?"}
                </span>
                <span className="hidden sm:inline">{user.name?.split(" ")[0]}</span>
                <ChevronDown size={12} className={`transition ${profileOpen ? "rotate-180" : ""}`} />
              </button>
              {profileOpen && (
                <div
                  data-testid="profile-menu"
                  className="absolute right-0 mt-2 w-56 gs-card p-2 z-30"
                >
                  <div className="px-3 py-2 border-b border-[color:var(--line-2)]">
                    <div className="text-sm text-[color:var(--ink)]">{user.name}</div>
                    <div className="text-[11px] font-mono text-[color:var(--ink-3)] truncate">{user.email}</div>
                    <div className="text-[10px] font-mono text-[color:var(--brand-3)] mt-1">
                      {ROLES[user.role]?.label || user.role}
                    </div>
                  </div>
                  {myRoles.length > 1 && (
                    <div className="border-b border-[color:var(--line-2)]" data-testid="profile-workspace-switcher">
                      <div className="px-3 pt-2 pb-1 text-[10px] font-mono text-[color:var(--ink-3)]">
                        SWITCH WORKSPACE
                      </div>
                      {myRoles.map((r) => {
                        const on = r === user.role;
                        const Icon = ROLES[r]?.icon || User;
                        return (
                          <button
                            key={r}
                            onClick={() => doSwitch(r)}
                            data-testid={`profile-workspace-${r}`}
                            className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[color:var(--brand-tint)] ${on ? "text-[color:var(--brand-3)]" : "text-[color:var(--ink-2)]"}`}
                          >
                            <Icon size={13} className="text-[color:var(--brand-3)]" />
                            <span className="flex-1">{ROLES[r]?.label || r}</span>
                            {on && <Check size={12} className="text-[color:var(--brand-3)]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button
                    onClick={() => { setProfileOpen(false); navigate(landingFor(user.role)); }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[color:var(--ink-2)] hover:bg-[color:var(--brand-tint)] hover:text-[color:var(--brand-3)]"
                    data-testid="profile-dashboard"
                  >
                    <User size={14} /> Dashboard
                  </button>
                  <button
                    onClick={() => { setProfileOpen(false); setShowPwdModal(true); }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[color:var(--ink-2)] hover:bg-[color:var(--brand-tint)] hover:text-[color:var(--brand-3)]"
                    data-testid="profile-change-password"
                  >
                    <KeyRound size={14} /> Change password
                  </button>
                  <button
                    onClick={() => { setProfileOpen(false); logout(); }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[color:var(--coral)] hover:bg-[color:var(--coral-tint)]"
                    data-testid="profile-logout"
                  >
                    <LogOut size={14} /> Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowBookDemo(true)}
                data-testid="topbar-book-demo-btn"
                className="hidden md:inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[color:var(--ink-2)] hover:text-[color:var(--brand-3)] transition border border-[color:var(--line)] hover:border-[color:var(--brand)] bg-[color:var(--bg-2)]"
              >
                <PhoneCall size={14} /> Book a Demo
              </button>
              <Link
                to="/login"
                data-testid="topbar-login-btn"
                className="rounded-full px-3 sm:px-4 py-2 text-sm text-[color:var(--ink-2)] hover:text-[color:var(--ink)] transition flex items-center gap-2 border border-[color:var(--line)] hover:border-[color:var(--ink)] bg-[color:var(--bg-2)]"
              >
                <LogIn size={14} /> <span className="hidden sm:inline">Login</span>
              </Link>
              <Link
                to="/register"
                data-testid="topbar-register-btn"
                className="!hidden md:!inline-flex gs-btn-primary text-sm py-2 px-4"
              >
                Get Started
              </Link>
            </>
          )}

          <button
            className="md:hidden rounded-full p-2 border border-[color:var(--line)] bg-[color:var(--bg-2)]"
            onClick={() => setOpen((v) => !v)}
            data-testid="topbar-menu-toggle"
            aria-label="Menu"
          >
            <Menu size={16} />
          </button>
        </div>

        {open && (
          <div className="md:hidden absolute top-[72px] left-0 right-0 bg-[color:var(--bg-2)] border-b border-[color:var(--line)] p-4 space-y-2">
            {!user && TOP_LINKS.map((l) => (
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
            {!user && (
              <button
                onClick={() => { setOpen(false); setShowBookDemo(true); }}
                data-testid="topbar-book-demo-btn-mobile"
                className="sidebar-link w-full text-left"
              >
                <PhoneCall size={14} /> Book a Demo
              </button>
            )}
          </div>
        )}
      </header>

      <PasswordChangeModal open={showPwdModal} onClose={() => setShowPwdModal(false)} />
      <BookDemoModal open={showBookDemo} onClose={() => setShowBookDemo(false)} />
    </>
  );
}
