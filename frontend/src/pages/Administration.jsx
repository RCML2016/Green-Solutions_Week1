import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ShieldCheck, Users as UsersIcon, Loader2, ArrowRight, Database, Bell, Sparkles, Inbox, Mail, Download,
} from "lucide-react";
import { ROLES } from "@/lib/roles";

const ROLE_ORDER = ["admin", "asset_manager", "om_manager", "technician", "executive", "performance_engineer", "client_viewer"];
const ALL_MVP_ROLES = ["executive", "asset_manager", "om_manager", "technician", "performance_engineer", "client_viewer", "admin"];

/** Administration hub — user management + system health + quick links. */
export default function Administration() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [health, setHealth] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scopeUser, setScopeUser] = useState(null); // for client scope editor modal

  const load = async () => {
    setLoading(true);
    try {
      const [u, h, l] = await Promise.all([
        api.get("/team/users"),
        api.get("/healthz"),
        api.get("/admin/leads?limit=25").catch(() => ({ data: { leads: [] } })),
      ]);
      setUsers(u.data);
      setHealth(h.data);
      setLeads(l.data.leads || []);
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

  const toggleExtraRole = async (u, role) => {
    const current = new Set(u.roles || [u.role]);
    if (current.has(role)) current.delete(role);
    else current.add(role);
    // Keep primary role first
    const list = [u.role, ...Array.from(current).filter((r) => r !== u.role)];
    try {
      await api.patch(`/team/users/${u.id}/roles`, { roles: list });
      toast.success(`Updated roles for ${u.email}`);
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <ShieldCheck size={12} /> ADMINISTRATION
          </div>
          <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
            Platform <span className="text-[color:var(--brand-3)]">controls</span>
          </h1>
          <p className="text-[color:var(--ink-3)] text-sm mt-2">
            Users, roles, integrations and configuration for the AssetNova platform.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-testid="admin-downloads">
          <a
            href={`${process.env.REACT_APP_BACKEND_URL}/api/download/team-credentials`}
            download
            data-testid="admin-download-credentials"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white px-3.5 py-2 text-xs font-mono text-[color:var(--ink-2)] hover:border-[color:var(--brand)] hover:text-[color:var(--brand-3)] transition shadow-sm"
          >
            <Download size={13} /> Credentials · CSV
          </a>
          <a
            href={`${process.env.REACT_APP_BACKEND_URL}/api/download/workflows-pdf`}
            download
            data-testid="admin-download-workflows"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white px-3.5 py-2 text-xs font-mono text-[color:var(--ink-2)] hover:border-[color:var(--brand)] hover:text-[color:var(--brand-3)] transition shadow-sm"
          >
            <Download size={13} /> Workflows · PDF
          </a>
          <a
            href={`${process.env.REACT_APP_BACKEND_URL}/api/download/test-cases-xlsx`}
            download
            data-testid="admin-download-testcases"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white px-3.5 py-2 text-xs font-mono text-[color:var(--ink-2)] hover:border-[color:var(--brand)] hover:text-[color:var(--brand-3)] transition shadow-sm"
          >
            <Download size={13} /> Test Cases · XLSX
          </a>
        </div>
      </div>

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

      {/* Leads Inbox — always-on, DB-backed, works whether external email push succeeded or not */}
      <div className="gs-card p-6 mt-8" data-testid="admin-leads-inbox">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[color:var(--brand-tint)] flex items-center justify-center">
              <Inbox size={16} className="text-[color:var(--brand-3)]" />
            </div>
            <div>
              <div className="font-mono text-[10px] text-[color:var(--ink-3)]">LEADS INBOX · BOOK-A-DEMO</div>
              <div className="text-sm text-[color:var(--ink)] mt-0.5">{leads.length} recent submissions · newest first</div>
            </div>
          </div>
          <div className="text-[10px] font-mono text-[color:var(--ink-3)]">STORED IN <span className="text-[color:var(--brand-3)]">contact_messages</span></div>
        </div>

        {leads.length === 0 ? (
          <div className="text-center py-10 text-sm text-[color:var(--ink-3)]" data-testid="admin-leads-empty">
            <Mail size={20} className="mx-auto text-[color:var(--ink-3)] mb-2 opacity-60" />
            No leads yet — this inbox fills up as visitors hit "Book a Demo" on the marketing site.
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--line)]">
            {leads.slice(0, 8).map((lead) => (
              <div key={lead.id} className="py-3 flex items-start justify-between gap-4" data-testid={`admin-lead-${lead.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm text-[color:var(--ink)]">
                    <span className="font-medium">{lead.name}</span>
                    <a href={`mailto:${lead.email}`} className="text-[color:var(--brand-3)] hover:underline text-xs">{lead.email}</a>
                  </div>
                  <div className="text-xs text-[color:var(--ink-2)] mt-1 line-clamp-2 whitespace-pre-wrap">
                    {lead.message}
                  </div>
                </div>
                <div className="text-[10px] font-mono text-[color:var(--ink-3)] whitespace-nowrap">
                  {new Date(lead.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
            {leads.length > 8 && (
              <div className="pt-3 text-[11px] font-mono text-[color:var(--ink-3)]">
                + {leads.length - 8} more · fetching latest 25 from DB
              </div>
            )}
          </div>
        )}
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
                  <th className="text-left py-2 px-2">PRIMARY ROLE</th>
                  <th className="text-left py-2 px-2">EXTRA ROLES</th>
                  <th className="text-left py-2 px-2">SCOPE</th>
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
                        {ALL_MVP_ROLES.map((r) => (
                          <option key={r} value={r}>{ROLES[r]?.label || r}</option>
                        ))}
                        {!ALL_MVP_ROLES.includes(u.role) && (
                          <option value={u.role}>{u.role} (legacy)</option>
                        )}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex flex-wrap gap-1" data-testid={`admin-extra-roles-${u.email}`}>
                        {ALL_MVP_ROLES.filter((r) => r !== u.role && r !== "admin").map((r) => {
                          const on = (u.roles || []).includes(r);
                          return (
                            <button
                              key={r}
                              onClick={() => toggleExtraRole(u, r)}
                              data-testid={`admin-toggle-${u.email}-${r}`}
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border transition ${
                                on
                                  ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]"
                                  : "border-[color:var(--line)] text-[color:var(--ink-3)] hover:border-[color:var(--brand)]"
                              }`}
                            >
                              {ROLES[r]?.label?.split(" ")[0] || r}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      {u.role === "client_viewer" || (u.roles || []).includes("client_viewer") ? (
                        <button
                          onClick={() => setScopeUser(u)}
                          data-testid={`admin-scope-${u.email}`}
                          className="text-[10px] font-mono px-2 py-1 rounded-full border border-[color:var(--brand)] text-[color:var(--brand-3)] bg-[color:var(--brand-tint)] hover:bg-white"
                        >
                          EDIT SITES
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-[color:var(--ink-3)]">—</span>
                      )}
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

      {scopeUser && (
        <ClientScopeModal
          user={scopeUser}
          onClose={() => setScopeUser(null)}
          onSaved={() => { setScopeUser(null); toast.success("Scope saved"); }}
        />
      )}
    </div>
  );
}

function ClientScopeModal({ user: targetUser, onClose, onSaved }) {
  const [scope, setScope] = useState({ allowed_site_ids: [], allowed_categories: [] });
  const [sites, setSites] = useState([]);
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      api.get(`/team/users/${targetUser.id}/client-scope`),
      api.get("/fleet/sites", { params: { limit: 100 } }),
      api.get("/fleet/categories"),
    ]).then(([s, sitesResp, catResp]) => {
      setScope(s.data);
      setSites(sitesResp.data.items);
      setCategories(catResp.data);
    }).catch(() => {});
  }, [targetUser.id]);

  const toggleSite = (siteId) => {
    setScope((s) => {
      const cur = new Set(s.allowed_site_ids);
      cur.has(siteId) ? cur.delete(siteId) : cur.add(siteId);
      return { ...s, allowed_site_ids: Array.from(cur) };
    });
  };
  const toggleCat = (cat) => {
    setScope((s) => {
      const cur = new Set(s.allowed_categories);
      cur.has(cat) ? cur.delete(cat) : cur.add(cat);
      return { ...s, allowed_categories: Array.from(cur) };
    });
  };
  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/team/users/${targetUser.id}/client-scope`, scope);
      onSaved();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  const filteredSites = search.trim()
    ? sites.filter((s) => s.site_id.toLowerCase().includes(search.toLowerCase()) || s.site_name.toLowerCase().includes(search.toLowerCase()))
    : sites;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="scope-modal">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-5 border-b border-[color:var(--line-2)] flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] text-[color:var(--ink-3)]">CLIENT SCOPE</div>
            <div className="text-sm text-[color:var(--ink)]">{targetUser.email}</div>
          </div>
          <button onClick={onClose} data-testid="scope-close" className="p-2 rounded-lg hover:bg-[color:var(--bg-3)] text-[color:var(--ink-3)]">
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          <div>
            <div className="font-mono text-[10px] text-[color:var(--ink-3)] mb-2">CATEGORIES (grants all sites of the type)</div>
            <div className="flex flex-wrap gap-1.5">
              {categories.filter((c) => c.site_count > 0).map((c) => {
                const on = scope.allowed_categories.includes(c.category);
                return (
                  <button
                    key={c.category}
                    onClick={() => toggleCat(c.category)}
                    data-testid={`scope-cat-${c.priority}`}
                    className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition ${on ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]" : "border-[color:var(--line)] text-[color:var(--ink-2)]"}`}
                  >
                    {c.category} · {c.site_count}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="font-mono text-[10px] text-[color:var(--ink-3)]">
                SITES · {scope.allowed_site_ids.length} approved
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="scope-search"
                placeholder="Filter..."
                className="gs-input text-xs"
                style={{ padding: "4px 10px", width: 180 }}
              />
            </div>
            <div className="max-h-64 overflow-y-auto border border-[color:var(--line-2)] rounded-xl divide-y divide-[color:var(--line-2)]">
              {filteredSites.map((s) => {
                const on = scope.allowed_site_ids.includes(s.site_id);
                return (
                  <label
                    key={s.site_id}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[color:var(--brand-mint)] ${on ? "bg-[color:var(--brand-tint)]" : ""}`}
                    data-testid={`scope-site-${s.site_id}`}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggleSite(s.site_id)} className="accent-[color:var(--brand)]" />
                    <span className="font-mono text-[11px] text-[color:var(--brand-3)] w-16">{s.site_id}</span>
                    <span className="text-xs text-[color:var(--ink)] flex-1 truncate">{s.site_name}</span>
                    <span className="text-[10px] font-mono text-[color:var(--ink-3)]">{s.site_type}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[color:var(--line-2)] flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-full border border-[color:var(--line)] py-2.5 text-sm text-[color:var(--ink-2)]">
            Cancel
          </button>
          <button onClick={save} disabled={busy} data-testid="scope-save" className="flex-1 gs-btn-primary justify-center text-sm disabled:opacity-60">
            {busy ? <Loader2 className="animate-spin" size={14} /> : null}
            Save Scope
          </button>
        </div>
      </div>
    </div>
  );
}
