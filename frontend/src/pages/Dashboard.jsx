import { useEffect, useState, useRef } from "react";
import { api, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Activity, Sparkles, Zap, AlertTriangle, Download, Send, Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const REFRESH_MS = 5000;

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState(false);
  const captureRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  // Polling
  useEffect(() => {
    let mounted = true;
    let timer = null;
    const fetchOnce = async () => {
      try {
        const { data } = await api.get("/portfolio/metrics");
        if (!mounted) return;
        setData(data);
        setPulse(true);
        setTimeout(() => mounted && setPulse(false), 700);
      } catch { /* ignore transient */ }
      finally {
        if (mounted) setLoading(false);
      }
    };
    fetchOnce();
    timer = setInterval(fetchOnce, REFRESH_MS);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  const sevColor = {
    high: "text-red-300 bg-red-500/10 border-red-500/20",
    medium: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    low: "text-[#6dfcb2] bg-[#22d17a]/10 border-[#22d17a]/20",
  };

  const exportPdf = async () => {
    if (!captureRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: "#062015",
        scale: 2,
        useCORS: true,
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const imgH = (canvas.height * pageW) / canvas.width;
      pdf.setFillColor(6, 32, 21);
      pdf.rect(0, 0, pageW, pdf.internal.pageSize.getHeight(), "F");
      pdf.addImage(img, "PNG", 0, 0, pageW, imgH);
      pdf.save(`green-solutions-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Report exported");
    } catch (e) {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="px-6 lg:px-14 py-10 min-h-[80vh]" data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span className={`pulse-dot ${pulse ? "opacity-100" : "opacity-90"}`} /> LIVE INTELLIGENCE · POLL {REFRESH_MS / 1000}s
          </div>
          <h1 className="font-display text-3xl md:text-4xl mt-3">
            Welcome, <span className="text-[#22d17a]">{user?.name?.split(" ")[0] || "Operator"}</span>.
          </h1>
          <p className="text-white/55 text-sm mt-2">
            Portfolio intelligence and AI findings — streaming from the intelligence pipeline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportPdf}
            disabled={exporting || !data}
            data-testid="export-pdf-btn"
            className="rounded-full px-5 py-2.5 text-sm font-semibold bg-[#22d17a] text-[#062015] hover:bg-[#6dfcb2] transition disabled:opacity-60 flex items-center gap-2"
          >
            {exporting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
            {exporting ? "Exporting..." : "Export Report"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-white/50 text-sm">Loading intelligence...</div>
      ) : data ? (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6" ref={captureRef}>
          <div>
            <div className="grid md:grid-cols-4 gap-4">
              {[
                { l: "PORTFOLIO HEALTH", v: `${data.portfolio_health}%`, d: `↑ ${data.portfolio_health_change}%`, i: Activity },
                { l: "AI FINDINGS", v: String(data.ai_findings).padStart(2, "0"), d: `${data.high_priority_findings} high priority`, i: Sparkles },
                { l: "AI CONFIDENCE", v: `${data.ai_confidence}%`, d: "Portfolio avg.", i: Sparkles },
                { l: "ENERGY 24H", v: `${data.energy_last_24h_mwh} MWh`, d: `${data.assets_online}/${data.assets_total} online`, i: Zap },
              ].map((k) => (
                <div key={k.l} className="rounded-2xl bg-[#0a2e1e] border border-white/5 p-5 transition" data-testid={`kpi-${k.l.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className="flex items-center justify-between text-[10px] font-mono text-white/50">
                    <span>{k.l}</span>
                    <k.i size={14} className="text-[#6dfcb2]" />
                  </div>
                  <div className={`font-display text-3xl mt-3 transition ${pulse ? "text-[#6dfcb2]" : "text-white"}`}>{k.v}</div>
                  <div className="text-[11px] text-[#6dfcb2] mt-1">{k.d}</div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-[#0a2e1e] border border-white/5 p-6 mt-6">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] text-white/50">ENERGY PERFORMANCE · LAST 24H</div>
                <span className="text-[11px] font-mono text-[#6dfcb2] border border-[#22d17a]/40 rounded-full px-3 py-1">AI MONITORING</span>
              </div>
              <svg viewBox="0 0 600 180" className="w-full h-56 mt-4">
                <defs>
                  <linearGradient id="dashg" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22d17a" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#22d17a" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[40, 80, 120, 160].map((y) => (
                  <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="rgba(255,255,255,0.05)" />
                ))}
                <path d="M0,140 C50,130 90,110 140,95 C190,80 230,90 280,70 C330,50 380,60 430,45 C480,30 530,35 600,20 L600,180 L0,180 Z" fill="url(#dashg)" />
                <path d="M0,140 C50,130 90,110 140,95 C190,80 230,90 280,70 C330,50 380,60 430,45 C480,30 530,35 600,20" fill="none" stroke="#22d17a" strokeWidth="2" />
              </svg>
            </div>

            <div className="rounded-2xl bg-[#0a2e1e] border border-white/5 p-6 mt-6">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] text-white/50">AI PRIORITY FINDINGS</div>
                <AlertTriangle size={14} className="text-amber-300" />
              </div>
              <div className="mt-3 divide-y divide-white/5">
                {data.findings.map((f) => (
                  <div key={f.code} className="py-3 flex items-center gap-3" data-testid={`finding-${f.code}`}>
                    <span className="font-mono text-[10px] text-[#6dfcb2]">{f.code}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/90 truncate">{f.title}</div>
                      <div className={`inline-block mt-1 text-[10px] font-mono border rounded-full px-2 py-0.5 ${sevColor[f.severity]}`}>
                        {f.severity.toUpperCase()}
                      </div>
                    </div>
                    <span className="font-mono text-xs text-white/70">{f.confidence}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <AiInsightPanel findings={data.findings} />
        </div>
      ) : (
        <div className="text-white/50 text-sm">Unable to load metrics.</div>
      )}
    </div>
  );
}

function AiInsightPanel({ findings }) {
  const [selected, setSelected] = useState("");
  const [q, setQ] = useState("Why is my portfolio health trending up?");
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const ask = async () => {
    if (!q.trim() || streaming) return;
    const userMsg = { role: "user", text: q, finding: selected || null };
    setMessages((m) => [...m, userMsg, { role: "assistant", text: "" }]);
    const question = q;
    const findingCode = selected;
    setQ("");
    setStreaming(true);

    try {
      const token = localStorage.getItem("gs_token");
      const res = await fetch(`${API}/ai/insight`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, finding_code: findingCode || null }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";
        for (const c of chunks) {
          const line = c.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const payload = JSON.parse(line.slice(5).trim());
            if (payload.delta) {
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { ...copy[copy.length - 1], text: copy[copy.length - 1].text + payload.delta };
                return copy;
              });
            }
            if (payload.error) {
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { ...copy[copy.length - 1], text: "⚠ " + payload.error };
                return copy;
              });
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { ...copy[copy.length - 1], text: "⚠ Assistant unavailable. Try again." };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <aside className="rounded-2xl bg-[#04180f] border border-white/5 flex flex-col h-fit lg:sticky lg:top-24" data-testid="ai-insight-panel">
      <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#22d17a]/15 text-[#6dfcb2] flex items-center justify-center">
          <Bot size={16} />
        </div>
        <div>
          <div className="text-sm font-medium">AI Insight Assistant</div>
          <div className="text-[10px] font-mono text-white/40">CLAUDE SONNET 5 · EXPLAINABLE</div>
        </div>
      </div>

      <div ref={scrollRef} className="p-5 space-y-3 max-h-[420px] overflow-y-auto min-h-[240px]">
        {messages.length === 0 && (
          <div className="text-xs text-white/50 leading-relaxed">
            Ask about any finding or portfolio metric. Try: <em>"Explain INV-04 and what to do next."</em>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === "user" ? "text-white/90" : "text-white/75"}`}>
            <div className="text-[10px] font-mono text-white/40 mb-1">
              {m.role === "user" ? "YOU" : "ASSISTANT"}{m.finding ? ` · ${m.finding}` : ""}
            </div>
            <div className={`rounded-xl px-3 py-2 ${m.role === "user" ? "bg-white/[0.04] border border-white/5" : "bg-[#22d17a]/10 border border-[#22d17a]/20"}`}>
              {m.text || (streaming && i === messages.length - 1 ? "…" : "")}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-white/5 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelected("")}
            className={`text-[10px] font-mono px-2 py-1 rounded-full border ${!selected ? "border-[#22d17a] text-[#6dfcb2]" : "border-white/10 text-white/50"}`}
          >
            GENERAL
          </button>
          {findings.map((f) => (
            <button
              key={f.code}
              onClick={() => setSelected(f.code)}
              className={`text-[10px] font-mono px-2 py-1 rounded-full border ${selected === f.code ? "border-[#22d17a] text-[#6dfcb2]" : "border-white/10 text-white/50"}`}
              data-testid={`ai-context-${f.code}`}
            >
              {f.code}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            data-testid="ai-input"
            placeholder="Ask about a finding..."
            className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#22d17a] text-white"
          />
          <button
            onClick={ask}
            disabled={streaming || !q.trim()}
            data-testid="ai-send"
            className="rounded-xl px-3 bg-[#22d17a] text-[#062015] hover:bg-[#6dfcb2] disabled:opacity-50"
          >
            {streaming ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </aside>
  );
}
