import { useEffect, useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { api, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Activity, Sparkles, Zap, AlertTriangle, Download, Send, Bot, Loader2, History, MessageSquarePlus, Trash2, Bell, Filter, X } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import OnboardingTour from "@/components/OnboardingTour";

const REFRESH_MS = 5000;

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState(false);
  const captureRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const aiPanelRef = useRef(null);
  const seenHighSevRef = useRef(new Set());
  const firstLoadRef = useRef(true);

  // Findings filter state
  const [filters, setFilters] = useState({
    severities: new Set(["high", "medium", "low"]),
    minConf: 0,
    search: "",
  });
  const toggleSev = (s) =>
    setFilters((f) => {
      const next = new Set(f.severities);
      next.has(s) ? next.delete(s) : next.add(s);
      return { ...f, severities: next };
    });
  const resetFilters = () => setFilters({ severities: new Set(["high", "medium", "low"]), minConf: 0, search: "" });

  useEffect(() => {
    let mounted = true;
    let timer = null;
    const fetchOnce = async () => {
      try {
        const { data: fresh } = await api.get("/portfolio/metrics");
        if (!mounted) return;

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
      } catch {}
      finally { if (mounted) setLoading(false); }
    };
    fetchOnce();
    timer = setInterval(fetchOnce, REFRESH_MS);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  const sevStyle = {
    high: { color: "#b91c1c", background: "#fee2e2", border: "#fecaca" },
    medium: { color: "#b45309", background: "#fef3c7", border: "#fde68a" },
    low: { color: "#065f46", background: "#d1fae5", border: "#a7f3d0" },
  };

  const exportPdf = async () => {
    if (!captureRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: "#f4f7f0", scale: 2, useCORS: true,
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const imgH = (canvas.height * pageW) / canvas.width;
      pdf.setFillColor(244, 247, 240);
      pdf.rect(0, 0, pageW, pdf.internal.pageSize.getHeight(), "F");
      pdf.addImage(img, "PNG", 0, 0, pageW, imgH);
      pdf.save(`green-solutions-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Report exported");
    } catch { toast.error("Export failed"); }
    finally { setExporting(false); }
  };

  return (
    <div className="px-6 lg:px-14 py-10 min-h-[80vh]" data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span className={`pulse-dot ${pulse ? "opacity-100" : "opacity-90"}`} /> LIVE INTELLIGENCE · POLL {REFRESH_MS / 1000}s
          </div>
          <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
            Welcome, <span className="text-[color:var(--brand-3)]">{user?.name?.split(" ")[0] || "Operator"}</span>.
          </h1>
          <p className="text-[color:var(--ink-3)] text-sm mt-2">
            Portfolio intelligence and AI findings — streaming from the intelligence pipeline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportPdf}
            disabled={exporting || !data}
            data-testid="export-pdf-btn"
            className="gs-btn-primary text-sm disabled:opacity-60"
          >
            {exporting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
            {exporting ? "Exporting..." : "Export Report"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-[color:var(--ink-3)] text-sm">Loading intelligence...</div>
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
                <div key={k.l} className="gs-card p-5" data-testid={`kpi-${k.l.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className="flex items-center justify-between text-[10px] font-mono text-[color:var(--ink-3)]">
                    <span>{k.l}</span>
                    <k.i size={14} className="text-[color:var(--brand-3)]" />
                  </div>
                  <div className={`font-display text-3xl mt-3 transition ${pulse ? "text-[color:var(--brand-3)]" : "text-[color:var(--ink)]"}`}>{k.v}</div>
                  <div className="text-[11px] text-[color:var(--brand-3)] mt-1">{k.d}</div>
                </div>
              ))}
            </div>

            <div className="gs-card p-6 mt-6">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] text-[color:var(--ink-3)]">ENERGY PERFORMANCE · LAST 24H</div>
                <span className="text-[11px] font-mono text-[color:var(--brand-3)] border border-[color:var(--brand)] bg-[color:var(--brand-tint)] rounded-full px-3 py-1">AI MONITORING</span>
              </div>
              <svg viewBox="0 0 600 180" className="w-full h-56 mt-4">
                <defs>
                  <linearGradient id="dash-light" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[40, 80, 120, 160].map((y) => (
                  <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#eaefe4" />
                ))}
                <path d="M0,140 C50,130 90,110 140,95 C190,80 230,90 280,70 C330,50 380,60 430,45 C480,30 530,35 600,20 L600,180 L0,180 Z" fill="url(#dash-light)" />
                <path d="M0,140 C50,130 90,110 140,95 C190,80 230,90 280,70 C330,50 380,60 430,45 C480,30 530,35 600,20" fill="none" stroke="#10b981" strokeWidth="2.2" />
              </svg>
            </div>

            <div className="gs-card p-6 mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-[color:var(--brand-3)]" />
                  <div className="font-mono text-[10px] text-[color:var(--ink-3)]">AI PRIORITY FINDINGS · FILTER</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {["high", "medium", "low"].map((s) => {
                    const on = filters.severities.has(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggleSev(s)}
                        data-testid={`filter-sev-${s}`}
                        className={`text-[10px] font-mono px-2 py-1 rounded-full border transition ${on ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]" : "border-[color:var(--line)] text-[color:var(--ink-3)]"}`}
                      >
                        {s.toUpperCase()}
                      </button>
                    );
                  })}
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[color:var(--ink-3)]">
                    MIN {filters.minConf}%
                    <input
                      type="range" min="0" max="99" step="1"
                      value={filters.minConf}
                      onChange={(e) => setFilters((f) => ({ ...f, minConf: Number(e.target.value) }))}
                      data-testid="filter-min-conf"
                      className="accent-[color:var(--brand)]"
                    />
                  </div>
                  <input
                    type="text" placeholder="Asset code / title..."
                    value={filters.search}
                    onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                    data-testid="filter-search"
                    className="gs-input text-xs"
                    style={{ padding: "6px 10px", width: 180 }}
                  />
                  <button
                    onClick={resetFilters}
                    data-testid="filter-reset"
                    className="p-1.5 rounded-lg border border-[color:var(--line)] text-[color:var(--ink-3)] hover:text-[color:var(--ink)]"
                    title="Reset"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
              <div className="mt-4 divide-y divide-[color:var(--line-2)]" data-testid="findings-list">
                {(() => {
                  const q = filters.search.trim().toLowerCase();
                  const list = data.findings.filter(
                    (f) =>
                      filters.severities.has(f.severity) &&
                      f.confidence >= filters.minConf &&
                      (!q || f.code.toLowerCase().includes(q) || f.title.toLowerCase().includes(q))
                  );
                  if (list.length === 0) {
                    return <div className="text-sm text-[color:var(--ink-3)] py-6 text-center" data-testid="findings-empty">No findings match your filters.</div>;
                  }
                  return list.map((f) => (
                    <div key={f.code} className="py-3 flex items-center gap-3" data-testid={`finding-${f.code}`}>
                      <span className="font-mono text-[10px] text-[color:var(--brand-3)]">{f.code}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[color:var(--ink)] truncate">{f.title}</div>
                        <span
                          className="inline-block mt-1 text-[10px] font-mono border rounded-full px-2 py-0.5"
                          style={{ color: sevStyle[f.severity].color, background: sevStyle[f.severity].background, borderColor: sevStyle[f.severity].border }}
                        >
                          {f.severity.toUpperCase()}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-[color:var(--ink-2)]">{f.confidence}%</span>
                      <button
                        onClick={() => aiPanelRef.current?.askAbout(f.code, f.title)}
                        data-testid={`ask-ai-${f.code}`}
                        className="text-[10px] font-mono px-2 py-1 rounded-full border border-[color:var(--line)] hover:border-[color:var(--brand)] hover:text-[color:var(--brand-3)] transition"
                      >
                        ASK AI
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          <AiInsightPanel ref={aiPanelRef} findings={data.findings} />
        </div>
      ) : (
        <div className="text-[color:var(--ink-3)] text-sm">Unable to load metrics.</div>
      )}

      {/* Onboarding tour: first-time users */}
      {data && <OnboardingTour />}
    </div>
  );
}

/* --------------------- AI Insight Panel (light) --------------------- */

const AiInsightPanel = forwardRef(function AiInsightPanel({ findings }, ref) {
  const [tab, setTab] = useState("chat");
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
    try { const { data } = await api.get("/ai/sessions"); setSessions(data); }
    catch {} finally { setLoadingSessions(false); }
  }, []);
  useEffect(() => { if (tab === "history") loadSessions(); }, [tab, loadSessions]);

  const openSession = async (id) => {
    try {
      const { data } = await api.get(`/ai/sessions/${id}`);
      setSessionId(id);
      setMessages(data.messages.map((m) => ({ role: m.role, text: m.text, finding: m.finding_code, auto: m.auto })));
      setTab("chat");
    } catch { toast.error("Failed to load session"); }
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
  const newSession = () => { setSessionId(null); setMessages([]); setSelected(""); setQ(""); setTab("chat"); };

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
    } finally { setStreaming(false); }
  };

  const ask = () => {
    if (!q.trim() || streaming) return;
    const question = q; setQ("");
    streamAsk(question, selected);
  };

  useImperativeHandle(ref, () => ({
    askAbout: (code, title) => {
      setTab("chat"); setSelected(code);
      streamAsk(`Explain ${code} (${title}) and what I should do next.`, code, false);
    },
    autoAsk: (code, title) => {
      setTab("chat"); setSelected(code);
      streamAsk(`ALERT — a new high-severity finding just appeared: ${code} · ${title}. Give me a 2-sentence root cause and one action.`, code, true);
    },
  }));

  return (
    <aside className="gs-card flex flex-col h-fit lg:sticky lg:top-24" data-testid="ai-insight-panel">
      <div className="px-5 py-4 border-b border-[color:var(--line-2)] flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[color:var(--brand-tint)] text-[color:var(--brand-3)] flex items-center justify-center">
          <Bot size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[color:var(--ink)]">AI Insight Assistant</div>
          <div className="text-[10px] font-mono text-[color:var(--ink-3)]">CLAUDE SONNET 5 · EXPLAINABLE</div>
        </div>
        <button onClick={newSession} title="New chat" data-testid="ai-new-session" className="p-1.5 rounded-lg hover:bg-[color:var(--brand-tint)] text-[color:var(--ink-3)] hover:text-[color:var(--brand-3)]">
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
            className={`flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-full transition ${tab === t.id ? "bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]" : "text-[color:var(--ink-3)] hover:text-[color:var(--ink)]"}`}
          >
            <t.icon size={12} /> {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "chat" ? (
        <>
          <div ref={scrollRef} className="p-5 space-y-3 max-h-[420px] overflow-y-auto min-h-[240px]">
            {messages.length === 0 && (
              <div className="text-xs text-[color:var(--ink-3)] leading-relaxed">
                Ask about any finding or metric. When a new high-severity finding appears, I'll auto-alert here with <Bell size={11} className="inline text-[color:var(--amber)] -mt-0.5" /> and suggest an action.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className="text-sm">
                <div className="text-[10px] font-mono text-[color:var(--ink-3)] mb-1 flex items-center gap-1.5">
                  {m.auto && <Bell size={11} className="text-[color:var(--amber)]" />}
                  {m.role === "user" ? (m.auto ? "AUTO-ALERT" : "YOU") : "ASSISTANT"}{m.finding ? ` · ${m.finding}` : ""}
                </div>
                <div
                  className="rounded-xl px-3 py-2 whitespace-pre-wrap border"
                  style={
                    m.role === "user"
                      ? m.auto
                        ? { color: "#8a5a00", background: "var(--amber-tint)", borderColor: "#fde68a" }
                        : { color: "var(--ink)", background: "#f6f8f2", borderColor: "var(--line-2)" }
                      : { color: "var(--ink)", background: "var(--brand-tint)", borderColor: "#c9ebd7" }
                  }
                >
                  {m.text || (streaming && i === messages.length - 1 ? "…" : "")}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-[color:var(--line-2)] space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelected("")}
                className={`text-[10px] font-mono px-2 py-1 rounded-full border ${!selected ? "border-[color:var(--brand)] text-[color:var(--brand-3)] bg-[color:var(--brand-tint)]" : "border-[color:var(--line)] text-[color:var(--ink-3)]"}`}
              >
                GENERAL
              </button>
              {findings.map((f) => (
                <button
                  key={f.code}
                  onClick={() => setSelected(f.code)}
                  className={`text-[10px] font-mono px-2 py-1 rounded-full border ${selected === f.code ? "border-[color:var(--brand)] text-[color:var(--brand-3)] bg-[color:var(--brand-tint)]" : "border-[color:var(--line)] text-[color:var(--ink-3)]"}`}
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
                className="gs-input flex-1"
              />
              <button
                onClick={ask}
                disabled={streaming || !q.trim()}
                data-testid="ai-send"
                className="rounded-xl px-3 gs-btn-primary disabled:opacity-50"
                style={{ padding: "10px 14px" }}
              >
                {streaming ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="p-4" data-testid="ai-history-list">
          {loadingSessions ? (
            <div className="text-xs text-[color:var(--ink-3)]">Loading history...</div>
          ) : sessions.length === 0 ? (
            <div className="text-xs text-[color:var(--ink-3)]">No past conversations yet.</div>
          ) : (
            <div className="space-y-1 max-h-[420px] overflow-y-auto">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSession(s.id)}
                  data-testid={`session-${s.id}`}
                  className={`w-full text-left rounded-xl border p-3 flex items-start gap-2 hover:border-[color:var(--brand)] transition ${s.id === sessionId ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)]" : "border-[color:var(--line-2)] bg-white"}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[color:var(--ink)] truncate">{s.title || "Untitled chat"}</div>
                    <div className="text-[10px] font-mono text-[color:var(--ink-3)] mt-1">
                      {new Date(s.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <span
                    onClick={(e) => removeSession(s.id, e)}
                    className="p-1 rounded text-[color:var(--ink-3)] hover:text-[color:var(--coral)] cursor-pointer"
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
