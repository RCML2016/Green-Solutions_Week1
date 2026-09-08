import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Route } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { visibleAppItems } from "@/lib/roles";

export default function DemoScenarioGuide() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const location = useLocation();
  if (!user || workspace?.mode !== "demo") return null;
  const scenario = workspace.scenarios?.find((item) => item.id === workspace.scenario);
  const allowed = new Set(visibleAppItems(user, workspace.features).map((item) => item.to));
  const steps = scenario?.steps?.filter((step) => user.role === "admin" || allowed.has(step.path)) || [];
  if (!steps.length) return null;
  return (
    <nav className="px-6 lg:px-10 py-2 border-b border-[color:var(--line)] bg-[color:var(--bg-2)] flex items-center gap-2 overflow-x-auto" aria-label="Demo scenario" data-testid="demo-scenario-guide">
      <Route size={13} className="text-[color:var(--brand-3)] shrink-0" />
      <span className="text-[10px] font-mono text-[color:var(--ink-3)] shrink-0">DEMO PATH</span>
      {steps.map((step, index) => (
        <span key={`${step.path}-${step.label}`} className="inline-flex items-center gap-2 shrink-0">
          {index > 0 && <ChevronRight size={12} className="text-[color:var(--ink-3)]" />}
          <Link to={step.path} className={`text-xs rounded-full px-3 py-1 border transition ${location.pathname === step.path ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]" : "border-[color:var(--line)] text-[color:var(--ink-2)] hover:border-[color:var(--brand)]"}`}>{index + 1}. {step.label}</Link>
        </span>
      ))}
    </nav>
  );
}
