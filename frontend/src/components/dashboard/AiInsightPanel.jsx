import { useEffect, useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { api, API } from "@/lib/api";
import { Bot, Send, Loader2, History, MessageSquarePlus, Trash2, Bell } from "lucide-react";
import { toast } from "sonner";

/**
 * AI Insight Panel — extracted from Dashboard.
 * Streams from Claude Sonnet 5 via `/api/ai/insight`, tracks session history.
 * Exposes `askAbout(code, title)` + `autoAsk(code, title)` via ref.
 */
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
    catch (e) { console.warn("AI sessions load failed:", e?.message); }
    finally { setLoadingSessions(false); }
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
          } catch (e) {
            console.warn("Skipping malformed SSE chunk:", e?.message);
          }
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
        {[{ id: "chat", label: "Chat", icon: Bot }, { id: "history", label: "History", icon: History }].map((t) => (
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
                        : { color: "var(--ink)", background: "var(--bg-3)", borderColor: "var(--line-2)" }
                      : { color: "var(--ink)", background: "var(--brand-tint)", borderColor: "var(--brand)" }
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

export default AiInsightPanel;
