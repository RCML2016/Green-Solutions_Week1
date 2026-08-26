import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { ROLES, landingFor } from "@/lib/roles";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Compact workspace switcher — only rendered when the user holds >1 role.
 * Fires POST /api/rbac/switch, refreshes the AuthContext, and navigates the
 * user to the new role's landing page.
 */
export default function WorkspaceSwitcher() {
  const { user, switchWorkspace } = useAuth();
  const [roles, setRoles] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/rbac/my-roles").then(({ data }) => setRoles(data.roles || [])).catch(() => setRoles([]));
  }, [user?.role]);

  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!user || roles.length <= 1) return null;

  const current = user.role;
  const meta = (r) => ROLES[r] || { label: r, icon: ROLES.executive.icon };

  const pick = async (role) => {
    if (role === current || busy) return;
    setBusy(true);
    const res = await switchWorkspace(role);
    setBusy(false);
    setOpen(false);
    if (res.ok) {
      toast.success(`Switched to ${ROLES[role]?.label || role}`);
      navigate(landingFor(role));
    } else {
      toast.error(res.error || "Switch failed");
    }
  };

  const CurrentIcon = meta(current).icon;

  return (
    <div className="px-4 pt-3" ref={wrapRef} data-testid="workspace-switcher">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        data-testid="workspace-switcher-btn"
        className="w-full rounded-xl border border-[color:var(--line-2)] bg-white/70 px-3 py-2 flex items-center gap-2 hover:border-[color:var(--brand)] transition"
      >
        {busy ? <Loader2 size={14} className="animate-spin text-[color:var(--brand-3)]" /> : <CurrentIcon size={14} className="text-[color:var(--brand-3)]" />}
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)]">WORKSPACE</div>
          <div className="text-xs font-medium text-[color:var(--ink)] truncate">{meta(current).label}</div>
        </div>
        <ChevronDown size={14} className={`text-[color:var(--ink-3)] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1 rounded-xl border border-[color:var(--line)] bg-white shadow-lg overflow-hidden" data-testid="workspace-switcher-menu">
          {roles.map((r) => {
            const M = meta(r).icon;
            const on = r === current;
            return (
              <button
                key={r}
                onClick={() => pick(r)}
                data-testid={`workspace-option-${r}`}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[color:var(--brand-mint)] transition ${on ? "bg-[color:var(--brand-tint)]" : ""}`}
              >
                <M size={13} className="text-[color:var(--brand-3)]" />
                <span className="text-xs text-[color:var(--ink)] flex-1">{meta(r).label}</span>
                {on && <Check size={12} className="text-[color:var(--brand-3)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
