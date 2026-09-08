import { FlaskConical, Radio, ShieldCheck } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";

const META = {
  demo: { icon: FlaskConical, label: "DEMO WORKSPACE", detail: "Synthetic data · external actions disabled", colors: "bg-amber-50 text-amber-900 border-amber-200" },
  pilot: { icon: ShieldCheck, label: "PILOT WORKSPACE", detail: "Customer validation · controlled actions", colors: "bg-blue-50 text-blue-900 border-blue-200" },
  production: { icon: Radio, label: "LIVE WORKSPACE", detail: "Production data and integrations", colors: "bg-emerald-50 text-emerald-900 border-emerald-200" },
};

export default function WorkspaceBanner() {
  const { workspace } = useWorkspace();
  if (!workspace) return null;
  const meta = META[workspace.mode] || META.demo;
  const Icon = meta.icon;
  const scenario = workspace.scenarios?.find((item) => item.id === workspace.scenario);
  return (
    <div data-testid="workspace-banner" className={`border-b px-6 lg:px-10 py-2 flex flex-wrap items-center justify-between gap-2 text-xs ${meta.colors}`}>
      <span className="inline-flex items-center gap-2 font-mono font-semibold"><Icon size={13} /> {meta.label}</span>
      <span>{meta.detail}{scenario ? ` · Scenario: ${scenario.label}` : ""}</span>
    </div>
  );
}
