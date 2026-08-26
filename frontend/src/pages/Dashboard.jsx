import { useEffect, useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { api, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Activity, Sparkles, Zap, AlertTriangle, Download, Send, Bot, Loader2, History, MessageSquarePlus, Trash2, Bell } from "lucide-react";
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

  // AI panel imperative handle for anomaly injection
  const aiPanelRef = useRef(null);
  const seenHighSevRef = useRef(new Set());
  const firstLoadRef = useRef(true);

  useEffect(() => {
    let mounted = true;
    let timer = null;
    const fetchOnce = async () => {
      try {
        const { data: fresh } = await api.get("/portfolio/metrics");
        if (!mounted) return;

        // --- Anomaly detection: new high-severity findings ---
        const currentHigh = fresh.findings.filter((f) => f.severity === "high").map((f) => f.code);
        if (firstLoadRef.current) {
          currentHigh.forEach((c) => seenHighSevRef.current.add(c));
          firstLoadRef.current = false;
        } else {
          const newOnes = currentHigh.filter((c) => !seenHighSevRef.current.has(c));
          newOnes.forEach((c) => {
            seenHighSevRef.current.add(c);
            const finding = fresh.findings.find((f) => f.code === c);
            if (finding && aiPanelRef.current) {
              toast.warning(`New high-severity finding: ${c}`, { description: finding.title });
              aiPanelRef.current.autoAsk(c, finding.title);
            }
          });
        }

        setData(fresh);
        setPulse(true);
        setTimeout(() => mounted && setPulse(false), 700);
      } catch { /* ignore */ }
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
        backgroundColor: "#062015", scale: 2, useCORS: true,
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
    } catch {
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
        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <div ref={captureRef}>
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
                    <button
                      onClick={() => aiPanelRef.current?.askAbout(f.code, f.title)}
                      data-testid={`ask-ai-${f.code}`}
                      className="text-[10px] font-mono px-2 py-1 rounded-full border border-white/10 hover:border-[#22d17a]/60 hover:text-[#6dfcb2] transition"
                    >
                      ASK AI
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <AiInsightPanel ref={aiPanelRef} findings={data.findings} />
        </div>
      ) : (
        <div className="text-white/50 text-sm">Unable to load metrics.</div>
      )}
    </div>
  );
}

/* --------------------- AI Insight Panel (with History) --------------------- */

const AiInsightPanel = forwardRef(function AiInsightPanel({ findings }, ref) {
  const [tab, setTab] = useState("chat"); // "chat" | "history"
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const { data } = await api.get("/ai/sessions");
      setSessions(data);
    } catch {} finally { setLoadingSessions(false); }
  }, []);

  useEffect(() => { if (tab === "history") loadSessions(); }, [tab, loadSessions]);

  const openSession = async (id) => {
    try {
      const { data } = await api.get(`/ai/sessions/${id}`);
      setSessionId(id);
      setMessages(data.messages.map((m) => ({ role: m.role, text: m.text, finding: m.finding_code, auto: m.auto })));
      setTab("chat");
    } catch (e) { toast.error("Failed to load session"); }
  };

  const removeSession = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    try {
      await api.delete(`/ai/sessions/${id}`);
      setSessions((s) => s.filter((x) => x.id !== id));
      if (sessionId === id) newSession();
      toast.success("Deleted");
    } catch { toast.error("Delete failed"); }
  };

  const newSession = () => {
    setSessionId(null);
    setMessages([]);
    setSelected("");
    setQ("");
    setTab("chat");
  };

  const streamAsk = async (question, findingCode, auto = false) => {
    setStreaming(true);
    const userMsg = { role: "user", text: question, finding: findingCode || null, auto };
    setMessages((m) => [...m, userMsg, { role: "assistant", text: "" }]);
    try {
      const token = localStorage.getItem("gs_token");
      const res = await fetch(`${API}/ai/insight`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, finding_code: findingCode || null, session_id: sessionId, auto }),
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
            if (payload.session_id && !sessionId) setSessionId(payload.session_id);
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
          } catch {}
        }
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { ...copy[copy.length - 1], text: "⚠ Assistant unavailable. Try again." };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  const ask = () => {
    if (!q.trim() || streaming) return;
    const question = q;
    setQ("");
    streamAsk(question, selected);
  };

  // Imperative handles used by parent Dashboard for auto-alerts and quick ask
  useImperativeHandle(ref, () => ({
    askAbout: (code, title) => {
      setTab("chat");
      setSelected(code);
      streamAsk(`Explain ${code} (${title}) and what I should do next.`, code, false);
    },
    autoAsk: (code, title) => {
      setTab("chat");
      setSelected(code);
      streamAsk(`ALERT — a new high-severity finding just appeared: ${code} · ${title}. Give me a 2-sentence root cause and one action.`, code, true);
    },
  }));

  return (
    <aside className="rounded-2xl bg-[#04180f] border border-white/5 flex flex-col h-fit lg:sticky lg:top-24" data-testid="ai-insight-panel">
      <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#22d17a]/15 text-[#6dfcb2] flex items-center justify-center">
          <Bot size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">AI Insight Assistant</div>
          <div className="text-[10px] font-mono text-white/40">CLAUDE SONNET 5 · EXPLAINABLE</div>
        </div>
        <button onClick={newSession} title="New chat" data-testid="ai-new-session" className="p-1.5 rounded-lg hover:bg-white/5 text-white/60 hover:text-[#6dfcb2]">
          <MessageSquarePlus size={14} />
        </button>
      </div>

      <div className="px-4 pt-3 flex gap-1">
        {[
          { id: "chat", label: "Chat", icon: Bot },
          { id: "history", label: "History", icon: History },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`ai-tab-${t.id}`}
            className={`flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-full transition ${tab === t.id ? "bg-[#22d17a]/15 text-[#6dfcb2]" : "text-white/50 hover:text-white/80"}`}
          >
            <t.icon size={12} /> {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "chat" ? (
        <>
          <div ref={scrollRef} className="p-5 space-y-3 max-h-[420px] overflow-y-auto min-h-[240px]">
            {messages.length === 0 && (
              <div className="text-xs text-white/50 leading-relaxed">
                Ask about any finding or metric. When a new high-severity finding appears, I'll auto-alert here with <Bell size={11} className="inline text-amber-300 -mt-0.5" /> and suggest an action.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`text-sm ${m.role === "user" ? "text-white/90" : "text-white/75"}`}>
                <div className="text-[10px] font-mono text-white/40 mb-1 flex items-center gap-1.5">
                  {m.auto && <Bell size={11} className="text-amber-300" />}
                  {m.role === "user" ? (m.auto ? "AUTO-ALERT" : "YOU") : "ASSISTANT"}{m.finding ? ` · ${m.finding}` : ""}
                </div>
                <div className={`rounded-xl px-3 py-2 whitespace-pre-wrap ${m.role === "user" ? (m.auto ? "bg-amber-500/5 border border-amber-500/20" : "bg-white/[0.04] border border-white/5") : "bg-[#22d17a]/10 border border-[#22d17a]/20"}`}>
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
        </>
      ) : (
        <div className="p-4" data-testid="ai-history-list">
          {loadingSessions ? (
            <div className="text-xs text-white/50">Loading history...</div>
          ) : sessions.length === 0 ? (
            <div className="text-xs text-white/50">No past conversations yet.</div>
          ) : (
            <div className="space-y-1 max-h-[420px] overflow-y-auto">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSession(s.id)}
                  data-testid={`session-${s.id}`}
                  className={`w-full text-left rounded-xl border p-3 flex items-start gap-2 hover:border-[#22d17a]/40 transition ${s.id === sessionId ? "border-[#22d17a]/60 bg-[#22d17a]/5" : "border-white/5"}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/90 truncate">{s.title || "Untitled chat"}</div>
                    <div className="text-[10px] font-mono text-white/40 mt-1">
                      {new Date(s.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <span
                    onClick={(e) => removeSession(s.id, e)}
                    className="p-1 rounded text-white/40 hover:text-red-300 cursor-pointer"
                    data-testid={`session-delete-${s.id}`}
                  >
                    <Trash2 size={13} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
});
