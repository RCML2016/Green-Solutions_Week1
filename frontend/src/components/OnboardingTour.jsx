import { useEffect, useState } from "react";
import { X, ArrowRight } from "lucide-react";

const STEPS = [
  {
    id: "kpis",
    target: '[data-testid="kpi-portfolio-health"]',
    title: "Live KPIs",
    body: "These cards refresh every 5 seconds. Watch health, findings and 24-hour energy update in real time.",
    placement: "bottom",
  },
  {
    id: "findings",
    target: '[data-testid^="finding-"]',
    title: "AI Findings",
    body: "Every high-severity anomaly is prioritized. Filter by severity, minimum confidence, or asset code up top.",
    placement: "top",
  },
  {
    id: "ai",
    target: '[data-testid="ai-insight-panel"]',
    title: "AI Insight Assistant",
    body: "Ask Claude anything about a finding — explanations, root causes and recommended actions stream back in seconds.",
    placement: "left",
  },
  {
    id: "export",
    target: '[data-testid="export-pdf-btn"]',
    title: "Export a Report",
    body: "One click renders the whole dashboard into a shareable PDF. Or head to Report Scheduler to auto-deliver.",
    placement: "bottom",
  },
];

const LS_KEY = "gs_tour_completed_v1";

export default function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(LS_KEY)) {
        // Give the dashboard a moment to render
        const t = setTimeout(() => setVisible(true), 900);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!visible) return;
    const update = () => {
      const el = document.querySelector(STEPS[step].target);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          const r = el.getBoundingClientRect();
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }, 400);
      } else {
        setRect(null);
      }
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step, visible]);

  const finish = () => {
    try { localStorage.setItem(LS_KEY, "1"); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  const s = STEPS[step];
  const cardStyle = { position: "fixed", zIndex: 60, maxWidth: 320 };
  if (rect) {
    const gap = 16;
    if (s.placement === "bottom") {
      cardStyle.top = rect.top + rect.height + gap;
      cardStyle.left = Math.max(16, Math.min(window.innerWidth - 336, rect.left));
    } else if (s.placement === "top") {
      cardStyle.top = Math.max(16, rect.top - 220);
      cardStyle.left = Math.max(16, Math.min(window.innerWidth - 336, rect.left));
    } else if (s.placement === "left") {
      cardStyle.top = Math.max(16, rect.top);
      cardStyle.left = Math.max(16, rect.left - 336);
    }
  } else {
    cardStyle.top = "50%";
    cardStyle.left = "50%";
    cardStyle.transform = "translate(-50%, -50%)";
  }

  return (
    <>
      {/* Dim backdrop with a hole cut-out via CSS mask isn't cross-browser reliable; use two overlays around the target */}
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]" onClick={finish} data-testid="tour-backdrop" />
      {rect && (
        <div
          className="fixed z-50 rounded-2xl pointer-events-none"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 3px #34d399",
            transition: "all .35s ease",
          }}
        />
      )}
      <div style={cardStyle} className="gs-card p-5" data-testid={`tour-step-${s.id}`}>
        <div className="flex items-start gap-3">
          <div className="eyebrow">STEP {step + 1} · OF {STEPS.length}</div>
          <button onClick={finish} className="ml-auto p-1 rounded hover:bg-[color:var(--brand-tint)] text-[color:var(--ink-3)]" data-testid="tour-close">
            <X size={14} />
          </button>
        </div>
        <h3 className="font-display text-xl mt-2 text-[color:var(--ink)]">{s.title}</h3>
        <p className="text-sm text-[color:var(--ink-2)] mt-2">{s.body}</p>
        <div className="flex items-center justify-between mt-5">
          <button onClick={finish} className="text-xs font-mono text-[color:var(--ink-3)] hover:text-[color:var(--ink)]" data-testid="tour-skip">
            Skip tour
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="gs-btn-primary text-sm"
              style={{ padding: "8px 16px" }}
              data-testid="tour-next"
            >
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={finish}
              className="gs-btn-primary text-sm"
              style={{ padding: "8px 16px" }}
              data-testid="tour-finish"
            >
              Get started
            </button>
          )}
        </div>
      </div>
    </>
  );
}
