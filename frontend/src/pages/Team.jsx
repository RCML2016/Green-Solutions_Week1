import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { UserPlus, Trash2, Copy, ShieldCheck, Wrench, ClipboardCheck, Crown } from "lucide-react";

const ROLES = [
  { value: "owner", label: "Owner", icon: Crown, desc: "Portfolio-level insight & reporting" },
  { value: "technician", label: "Technician", icon: Wrench, desc: "Field ops & finding actions" },
  { value: "compliance", label: "Compliance", icon: ClipboardCheck, desc: "Audit reports & explainability" },
  { value: "admin", label: "Admin", icon: ShieldCheck, desc: "Full platform + team access" },
];

export default function Team() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", role: "technician" });
  const [busy, setBusy] = useState(false);
  const [lastInvite, setLastInvite] = useState(null);

  const load = async () => {
    try { const { data } = await api.get("/team/users"); setUsers(data); }
    catch (e) { if (user?.role === "admin") toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (user && user.role === "admin") load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  if (user && user.role !== "admin") return <Navigate to="/dashboard" replace />;

  const invite = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const { data } = await api.post("/team/invite", form);
      setLastInvite(data);
      setForm({ name: "", email: "", role: "technician" });
      toast.success(`Invited ${data.user.email}`);
      await load();
    } catch (er) { toast.error(formatApiError(er)); }
    finally { setBusy(false); }
  };

  const remove = async (u) => {
    if (u.id === user.id) return;
    if (!window.confirm(`Remove ${u.email}?`)) return;
    try { await api.delete(`/team/users/${u.id}`); toast.success("User removed"); await load(); }
    catch (er) { toast.error(formatApiError(er)); }
  };

  const roleColor = {
    admin: { color: "#065f46", background: "var(--brand-tint)", border: "var(--brand)" },
    owner: { color: "#92400e", background: "#fef3c7", border: "#fde68a" },
    technician: { color: "#1e40af", background: "#dbeafe", border: "#bfdbfe" },
    compliance: { color: "#6b21a8", background: "#f3e8ff", border: "#e9d5ff" },
    user: { color: "#374151", background: "#f3f4f6", border: "#e5e7eb" },
  };

  return (
    <div className="px-6 lg:px-14 py-10 min-h-[80vh]" data-testid="team-page">
      <div className="eyebrow">TEAM ACCESS · RBAC</div>
      <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
        Invite operators. <span className="text-[color:var(--brand-3)]">Scope their view.</span>
      </h1>
      <p className="text-[color:var(--ink-3)] text-sm mt-2 max-w-xl">
        Each role sees a dashboard tailored to their job. Admins manage access; owners see portfolio ROI;
        technicians see findings; compliance sees audit trails.
      </p>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6 mt-10">
        <form onSubmit={invite} data-testid="team-invite-form" className="gs-card p-6 h-fit">
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-[color:var(--brand-3)]" />
            <h2 className="font-display text-xl text-[color:var(--ink)]">Invite a teammate</h2>
          </div>
          <div className="space-y-3 mt-5">
            <div>
              <label className="text-[10px] font-mono text-[color:var(--ink-3)]">FULL NAME</label>
              <input required data-testid="invite-name"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="gs-input mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[color:var(--ink-3)]">EMAIL</label>
              <input required type="email" data-testid="invite-email"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="gs-input mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[color:var(--ink-3)]">ROLE</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ROLES.map((r) => (
                  <button key={r.value} type="button"
                    onClick={() => setForm({ ...form, role: r.value })}
                    data-testid={`invite-role-${r.value}`}
                    className={`text-left rounded-xl p-3 border transition ${form.role === r.value ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)]" : "border-[color:var(--line)] hover:border-[color:var(--brand)] bg-white"}`}
                  >
                    <div className="flex items-center gap-2 text-sm text-[color:var(--ink)]">
                      <r.icon size={14} className="text-[color:var(--brand-3)]" />
                      {r.label}
                    </div>
                    <div className="text-[10px] text-[color:var(--ink-3)] mt-1">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button disabled={busy} data-testid="invite-submit" className="gs-btn-primary w-full justify-center mt-5 disabled:opacity-60">
            {busy ? "Creating..." : "Create Access"}
          </button>

          {lastInvite && (
            <div data-testid="invite-result" className="mt-5 rounded-xl border border-[color:var(--brand)] bg-[color:var(--brand-tint)] p-4">
              <div className="text-[10px] font-mono text-[color:var(--brand-3)]">TEMPORARY PASSWORD · SHARE ONCE</div>
              <div className="flex items-center justify-between mt-2 gap-2">
                <code className="text-sm text-[color:var(--ink)] break-all">{lastInvite.temporary_password}</code>
                <button type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(lastInvite.temporary_password);
                      toast.success("Copied");
                    } catch (e) {
                      console.warn("Clipboard write failed:", e?.message);
                      toast.error("Copy failed — select the password manually");
                    }
                  }}
                  data-testid="copy-temp-password"
                  className="p-1.5 rounded-lg hover:bg-white/60 text-[color:var(--ink-2)]"
                >
                  <Copy size={14} />
                </button>
              </div>
              <div className="text-[11px] text-[color:var(--ink-2)] mt-2">{lastInvite.message}</div>
            </div>
          )}
        </form>

        <div className="gs-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-[color:var(--ink)]">Team members</h2>
            <span className="text-[10px] font-mono text-[color:var(--ink-3)]">{users.length} MEMBER{users.length === 1 ? "" : "S"}</span>
          </div>
          {loading ? (
            <div className="text-sm text-[color:var(--ink-3)] mt-4">Loading team...</div>
          ) : (
            <div className="mt-4 divide-y divide-[color:var(--line-2)]">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 py-3" data-testid={`team-row-${u.email}`}>
                  <div className="w-9 h-9 rounded-full bg-[color:var(--brand-tint)] text-[color:var(--brand-3)] flex items-center justify-center text-sm font-semibold">
                    {u.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[color:var(--ink)] truncate">{u.name}</div>
                    <div className="text-[11px] font-mono text-[color:var(--ink-3)]">{u.email}</div>
                  </div>
                  <span className="text-[10px] font-mono border rounded-full px-2 py-1"
                    style={roleColor[u.role] || roleColor.user}>
                    {u.role.toUpperCase()}
                  </span>
                  <button disabled={u.id === user?.id} onClick={() => remove(u)}
                    data-testid={`team-remove-${u.email}`}
                    className="p-2 rounded-lg text-[color:var(--ink-3)] hover:text-[color:var(--coral)] hover:bg-[color:var(--coral-tint)] disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title={u.id === user?.id ? "That's you" : "Remove"}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
