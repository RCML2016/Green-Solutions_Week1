import { useState, useEffect, useRef } from "react";
import { api, formatApiError } from "@/lib/api";
import { Sparkles, FileText, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import AiInsightPanel from "@/components/dashboard/AiInsightPanel";

/** AI Intelligence — full-page workspace for the AI Insight Assistant + Weekly Digest. */
export default function AiIntelligence() {
  const [findings, setFindings] = useState([]);
  const [digest, setDigest] = useState(null);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    api.get("/fleet/alarms", { params: { severity: "High", limit: 6 } })
      .then(({ data }) => {
        setFindings(
          data.items.slice(0, 4).map((a) => ({
            code: a.alarm_id.replace("AL", "AL-"),
            title: `${a.root_cause_category} @ ${a.site_id}`,
            severity: "high",
            confidence: Math.min(99, Math.max(60, Math.round(100 - (a.duration_hours || 0) * 1.2))),
          }))
        );
      })
      .catch(() => setFindings([]));
  }, []);

  const generateDigest = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/reports/weekly-digest", {});
      setDigest(data);
      toast.success("Digest generated");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-6 lg:px-14 py-10 max-w-full overflow-x-hidden" data-testid="ai-intelligence-page">
      <div className="eyebrow flex items-center gap-2">
        <Sparkles size={12} /> AI INTELLIGENCE
      </div>
      <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
        Claude Sonnet 5 · <span className="text-[color:var(--brand-3)]">explainable AI</span>
      </h1>
      <p className="text-[color:var(--ink-3)] text-sm mt-2">
        Ask about any finding, request root causes, generate a weekly digest, or replay
        past conversations from the history tab.
      </p>

      <div className="grid lg:grid-cols-[1fr_420px] gap-6 mt-8">
        {/* Weekly digest generator */}
        <div className="gs-card p-6" data-testid="ai-digest-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-mono text-[10px] text-[color:var(--ink-3)]">WEEKLY DIGEST</div>
              <div className="text-sm text-[color:var(--ink)] mt-1">One-click summary of alerts + accepted actions</div>
            </div>
            <button
              onClick={generateDigest}
              disabled={busy}
              data-testid="ai-generate-digest"
              className="gs-btn-primary text-sm disabled:opacity-60"
            >
              {busy ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />}
              {busy ? "Generating..." : "Generate Digest"}
            </button>
          </div>
          {digest ? (
            <div className="space-y-3" data-testid="ai-digest-body">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-[color:var(--bg-3)] p-3">
                  <div className="text-[10px] font-mono text-[color:var(--ink-3)]">ALERTS</div>
                  <div className="font-display text-2xl text-[color:var(--ink)]">{digest.alerts_count}</div>
                </div>
                <div className="rounded-xl bg-[color:var(--bg-3)] p-3">
                  <div className="text-[10px] font-mono text-[color:var(--ink-3)]">ACTIONS</div>
                  <div className="font-display text-2xl text-[color:var(--ink)]">{digest.actions_count}</div>
                </div>
                <div className="rounded-xl bg-[color:var(--brand-tint)] p-3">
                  <div className="text-[10px] font-mono text-[color:var(--ink-3)]">GENERATED</div>
                  <div className="text-xs mt-1 text-[color:var(--brand-3)]">
                    {new Date(digest.generated_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-[color:var(--brand)] bg-[color:var(--brand-tint)] p-4 text-sm text-[color:var(--ink)] whitespace-pre-wrap leading-relaxed">
                {digest.digest}
              </div>
              <button
                onClick={() => {
                  const blob = new Blob([digest.digest], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `green-solutions-digest-${new Date().toISOString().slice(0,10)}.txt`;
                  a.click(); URL.revokeObjectURL(url);
                }}
                data-testid="ai-download-digest"
                className="text-[11px] font-mono text-[color:var(--brand-3)] hover:underline inline-flex items-center gap-1"
              >
                <Download size={11} /> DOWNLOAD .TXT
              </button>
            </div>
          ) : (
            <div className="text-sm text-[color:var(--ink-3)]">
              Click "Generate Digest" to have Claude summarise the week's alerts and accepted actions.
              The digest is grounded in your own data — no hallucinated numbers.
            </div>
          )}
        </div>

        {/* Chat panel */}
        <AiInsightPanel ref={panelRef} findings={findings} />
      </div>
    </div>
  );
}
