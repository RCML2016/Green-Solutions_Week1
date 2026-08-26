import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ShieldCheck, Users as UsersIcon, Loader2, ArrowRight, Database, Bell, Sparkles,
} from "lucide-react";
import { ROLES } from "@/lib/roles";

const ROLE_ORDER = ["admin", "asset_manager", "om_manager", "technician", "executive"];

/** Administration hub — user management + system health + quick links. */
export default function Administration() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [u, h] = await Promise.all([
        api.get("/team/users"),
        api.get("/healthz"),
      ]);
      setUsers(u.data);
      setHealth(h.data);
    } catch (e) {
      if (user?.role === "admin") toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  if (user && user.role !== "admin") return <Navigate to="/dashboard" replace />;

  const changeRole = async (u, newRole) => {
    if (u.role === newRole) return;
    try {
      await api.patch(`/team/users/${u.id}/role`, { role: newRole });
      toast.success(`${u.email} → ${newRole}`);
      await load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const byRole = ROLE_ORDER.reduce((acc, r) => {
    acc[r] = users.filter((u) => u.role === r).length;
    return acc;
  }, {});

  return (
    <div className="px-6 lg:px-14 py-10 max-w-full overflow-x-hidden" data-testid="admin-page">
      <div className="eyebrow flex items-center gap-2">
        <ShieldCheck size={12} /> ADMINISTRATION
      </div>
      <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
        Platform <span className="text-[color:var(--brand-3)]">controls</span>
      </h1>
      <p className="text-[color:var(--ink-3)] text-sm mt-2">
        Users, roles, integrations and configuration for the Green Solutions platform.
      </p>

      {/* System KPIs */}
      <div className="grid md:grid-cols-4 gap-4 mt-8">
        <div className="gs-card p-5" data-testid="admin-kpi-users">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            USERS <UsersIcon size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">{users.length}</div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">Across {Object.values(byRole).filter(Boolean).length} roles</div>
        </div>
        <div className="gs-card p-5" data-testid="admin-kpi-sites">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            SEEDED SITES <Database size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">{health?.fleet_sites ?? "—"}</div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">MongoDB collections</div>
        </div>
        <div className="gs-card p-5" data-testid="admin-kpi-uptime">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            API HEALTH <Bell size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">
            {health?.ok ? "OK" : "—"}
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">
            {health?.time ? new Date(health.time).toLocaleTimeString() : ""}
          </div>
        </div>
        <div className="gs-card p-5" data-testid="admin-kpi-ai">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            AI PROVIDER <Sparkles size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-xl mt-2 text-[color:var(--ink)]">Claude Sonnet 5</div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">via Emergent Universal Key</div>
        </div>
      </div>

      {/* Users table */}
      <div className="gs-card p-6 mt-8" data-testid="admin-users-table">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-mono text-[10px] text-[color:var(--ink-3)]">USER MANAGEMENT</div>
            <div className="text-sm text-[color:var(--ink)] mt-1">{users.length} accounts · change role inline</div>
          </div>
          <Link to="/team" data-testid="admin-invite-link" className="text-[11px] font-mono text-[color:var(--brand-3)] hover:underline inline-flex items-center gap-1">
            Invite new <ArrowRight size={11} />
          </Link>
        </div>
        {loading ? (
          <div className="text-[color:var(--ink-3)] text-sm flex items-center gap-2">
            <Loader2 className="animate-spin" size={14} /> Loading users…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-mono text-[color:var(--ink-3)] border-b border-[color:var(--line-2)]">
                  <th className="text-left py-2 px-2">NAME</th>
                  <th className="text-left py-2 px-2">EMAIL</th>
                  <th className="text-left py-2 px-2">ROLE</th>
                  <th className="text-left py-2 px-2">CREATED</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[color:var(--line-2)]" data-testid={`admin-user-${u.email}`}>
                    <td className="py-2 px-2 text-[color:var(--ink)]">{u.name}</td>
                    <td className="py-2 px-2 text-[color:var(--ink-2)] font-mono text-xs">{u.email}</td>
                    <td className="py-2 px-2">
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value)}
                        disabled={u.id === user.id}
                        data-testid={`admin-role-select-${u.email}`}
                        className="gs-input text-xs"
                        style={{ padding: "4px 8px" }}
                      >
                        {["executive", "asset_manager", "om_manager", "technician", "admin"].map((r) => (
                          <option key={r} value={r}>{ROLES[r]?.label || r}</option>
                        ))}
                        {!["executive", "asset_manager", "om_manager", "technician", "admin"].includes(u.role) && (
                          <option value={u.role}>{u.role} (legacy)</option>
                        )}
                      </select>
                    </td>
                    <td className="py-2 px-2 text-[10px] font-mono text-[color:var(--ink-3)]">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick jump */}
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        <Link to="/team" className="gs-card p-5 hover:border-[color:var(--brand)] transition" data-testid="admin-cta-team">
          <div className="font-mono text-[10px] text-[color:var(--ink-3)]">TEAM INVITE</div>
          <div className="font-display text-xl text-[color:var(--ink)] mt-2">Add new users →</div>
        </Link>
        <Link to="/reports" className="gs-card p-5 hover:border-[color:var(--brand)] transition" data-testid="admin-cta-reports">
          <div className="font-mono text-[10px] text-[color:var(--ink-3)]">REPORT SCHEDULING</div>
          <div className="font-display text-xl text-[color:var(--ink)] mt-2">Configure branding & delivery →</div>
        </Link>
        <Link to="/dashboard" className="gs-card p-5 hover:border-[color:var(--brand)] transition" data-testid="admin-cta-fleet">
          <div className="font-mono text-[10px] text-[color:var(--ink-3)]">FLEET DASHBOARD</div>
          <div className="font-display text-xl text-[color:var(--ink)] mt-2">380 sites · live view →</div>
        </Link>
      </div>
    </div>
  );
}
