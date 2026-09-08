import { useEffect, useState } from "react";
import { RotateCcw, Save, Settings2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { useWorkspace } from "@/context/WorkspaceContext";

const FLAG_LABELS = {
  overview: "Overview", portfolio: "Portfolio", assets: "Assets", ai: "AI Intelligence",
  operations: "Operations", work_orders: "Work Orders", reports: "Reports",
  evidence_upload: "Evidence Upload", notifications: "Notifications",
  external_integrations: "External Integrations",
  my_work: "Technician Workspace", performance: "Performance", client_portal: "Client Portal",
};

export default function WorkspaceControl() {
  const { workspace, refreshWorkspace } = useWorkspace();
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (workspace) setDraft({ mode: workspace.mode, scenario: workspace.scenario, features: workspace.features }); }, [workspace]);
  if (!draft || !workspace) return null;

  const save = async () => {
    setBusy(true);
    try {
      await api.patch("/workspace", draft);
      await refreshWorkspace();
      toast.success("Workspace configuration saved");
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setBusy(false); }
  };

  const reset = async () => {
    if (!window.confirm("Reset all demo fleet data and transient demo activity to the shipped baseline?")) return;
    setBusy(true);
    try {
      await api.post("/workspace/reset-demo");
      await refreshWorkspace();
      toast.success("Demo restored to its baseline scenario");
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setBusy(false); }
  };

  return (
    <section className="gs-card p-6 mt-8" data-testid="workspace-control">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] text-[color:var(--ink-3)] flex items-center gap-2"><Settings2 size={13} /> WORKSPACE MODE</div>
          <div className="text-sm text-[color:var(--ink)] mt-1">Run Demo, Pilot and Live from the same codebase.</div>
        </div>
        <div className="flex gap-2">
          {workspace.mode === "demo" && <button onClick={reset} disabled={busy} className="gs-btn-secondary text-xs" data-testid="reset-demo"><RotateCcw size={13} /> Reset Demo</button>}
          <button onClick={save} disabled={busy} className="gs-btn-primary text-xs" data-testid="save-workspace">{busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save</button>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mt-5">
        <label className="text-xs text-[color:var(--ink-2)]">Operating mode
          <select className="gs-input w-full mt-1" value={draft.mode} onChange={(e) => setDraft((d) => ({ ...d, mode: e.target.value }))}>
            <option value="demo">Demo</option><option value="pilot">Initial Pilot</option><option value="production">Working Live Site</option>
          </select>
        </label>
        <label className="text-xs text-[color:var(--ink-2)]">Demo scenario
          <select className="gs-input w-full mt-1" value={draft.scenario} onChange={(e) => setDraft((d) => ({ ...d, scenario: e.target.value }))} disabled={draft.mode !== "demo"}>
            {workspace.scenarios?.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-5">
        <div className="font-mono text-[10px] text-[color:var(--ink-3)] mb-2">FEATURE FLAGS</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(FLAG_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-lg border border-[color:var(--line)] px-3 py-2 text-xs text-[color:var(--ink-2)]">
              <input type="checkbox" checked={draft.features?.[key] !== false} onChange={(e) => setDraft((d) => ({ ...d, features: { ...d.features, [key]: e.target.checked } }))} /> {label}
            </label>
          ))}
        </div>
      </div>
      {draft.mode !== "production" && <p className="mt-4 text-xs text-amber-700">External notifications, uploads and integrations remain server-blocked outside Live mode.</p>}
    </section>
  );
}
