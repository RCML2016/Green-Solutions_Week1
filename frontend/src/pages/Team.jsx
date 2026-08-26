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
    try {
      const { data } = await api.get("/team/users");
      setUsers(data);
    } catch (e) {
      // Only surface a toast for admins; non-admins will be redirected below.
      if (user?.role === "admin") toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === "admin") load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  if (user && user.role !== "admin") return <Navigate to="/dashboard" replace />;

  const invite = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/team/invite", form);
      setLastInvite(data);
      setForm({ name: "", email: "", role: "technician" });
      toast.success(`Invited ${data.user.email}`);
      await load();
    } catch (er) {
      toast.error(formatApiError(er));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u) => {
    if (u.id === user.id) return;
    if (!window.confirm(`Remove ${u.email}?`)) return;
    try {
      await api.delete(`/team/users/${u.id}`);
      toast.success("User removed");
      await load();
    } catch (er) {
      toast.error(formatApiError(er));
    }
  };

  const roleColor = {
    admin: "bg-[#22d17a]/15 text-[#6dfcb2] border-[#22d17a]/40",
    owner: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    technician: "bg-blue-400/10 text-blue-300 border-blue-400/30",
    compliance: "bg-purple-400/10 text-purple-300 border-purple-400/30",
  };

  return (
    <div className="px-6 lg:px-14 py-10 min-h-[80vh]" data-testid="team-page">
      <div className="eyebrow">TEAM ACCESS · RBAC</div>
      <h1 className="font-display text-3xl md:text-4xl mt-3">
        Invite operators. <span className="text-[#22d17a]">Scope their view.</span>
      </h1>
      <p className="text-white/55 text-sm mt-2 max-w-xl">
        Each role sees a dashboard tailored to their job. Admins manage access; owners see portfolio ROI;
        technicians see findings; compliance sees audit trails.
      </p>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6 mt-10">
        {/* Invite */}
        <form onSubmit={invite} data-testid="team-invite-form" className="rounded-2xl bg-[#0a2e1e] border border-white/5 p-6 h-fit">
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-[#6dfcb2]" />
            <h2 className="font-display text-xl">Invite a teammate</h2>
          </div>
          <div className="space-y-3 mt-5">
            <div>
              <label className="text-[10px] font-mono text-white/50">FULL NAME</label>
              <input
                required data-testid="invite-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#22d17a] text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-white/50">EMAIL</label>
              <input
                required type="email" data-testid="invite-email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#22d17a] text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-white/50">ROLE</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm({ ...form, role: r.value })}
                    data-testid={`invite-role-${r.value}`}
                    className={`text-left rounded-xl p-3 border transition ${form.role === r.value ? "border-[#22d17a] bg-[#22d17a]/10" : "border-white/10 hover:border-white/25"}`}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <r.icon size={14} className="text-[#6dfcb2]" />
                      {r.label}
                    </div>
                    <div className="text-[10px] text-white/50 mt-1">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button disabled={busy} data-testid="invite-submit" className="gs-btn-primary w-full justify-center mt-5 disabled:opacity-60">
            {busy ? "Creating..." : "Create Access"}
          </button>

          {lastInvite && (
            <div data-testid="invite-result" className="mt-5 rounded-xl border border-[#22d17a]/30 bg-[#22d17a]/5 p-4">
              <div className="text-[10px] font-mono text-[#6dfcb2]">TEMPORARY PASSWORD · SHARE ONCE</div>
              <div className="flex items-center justify-between mt-2 gap-2">
                <code className="text-sm text-white break-all">{lastInvite.temporary_password}</code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(lastInvite.temporary_password); toast.success("Copied"); }}
                  className="p-1.5 rounded-lg hover:bg-white/5"
                >
                  <Copy size={14} />
                </button>
              </div>
              <div className="text-[11px] text-white/50 mt-2">{lastInvite.message}</div>
            </div>
          )}
        </form>

        {/* User table */}
        <div className="rounded-2xl bg-[#0a2e1e] border border-white/5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Team members</h2>
            <span className="text-[10px] font-mono text-white/50">{users.length} MEMBER{users.length === 1 ? "" : "S"}</span>
          </div>
          {loading ? (
            <div className="text-sm text-white/50 mt-4">Loading team...</div>
          ) : (
            <div className="mt-4 divide-y divide-white/5">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 py-3" data-testid={`team-row-${u.email}`}>
                  <div className="w-9 h-9 rounded-full bg-[#22d17a]/15 text-[#6dfcb2] flex items-center justify-center text-sm font-semibold">
                    {u.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/90 truncate">{u.name}</div>
                    <div className="text-[11px] font-mono text-white/45">{u.email}</div>
                  </div>
                  <span className={`text-[10px] font-mono border rounded-full px-2 py-1 ${roleColor[u.role] || "border-white/10 text-white/60"}`}>
                    {u.role.toUpperCase()}
                  </span>
                  <button
                    disabled={u.id === user?.id}
                    onClick={() => remove(u)}
                    data-testid={`team-remove-${u.email}`}
                    className="p-2 rounded-lg text-white/50 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
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
