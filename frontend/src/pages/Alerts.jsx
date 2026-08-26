import { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Bell, AlertTriangle, CheckCircle2, Filter } from "lucide-react";

const SEVERITIES = ["all", "high", "medium", "low"];
const RANGES = [
  { label: "Last 24h", hours: 24 },
  { label: "Last 7 days", hours: 168 },
  { label: "Last 30 days", hours: 720 },
];

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState("all");
  const [hours, setHours] = useState(168);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { since_hours: hours };
      if (severity !== "all") params.severity = severity;
      const { data } = await api.get("/alerts", { params });
      setAlerts(data);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  }, [severity, hours]);

  useEffect(() => { load(); }, [load]);

  const ack = async (id) => {
    try { await api.post(`/alerts/${id}/acknowledge`); await load(); toast.success("Acknowledged"); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const filtered = alerts.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return a.code.toLowerCase().includes(q) || a.title.toLowerCase().includes(q);
  });

  const sevColor = {
    high: { color: "#b91c1c", background: "#fee2e2", border: "#fecaca" },
    medium: { color: "#b45309", background: "#fef3c7", border: "#fde68a" },
    low: { color: "#065f46", background: "#d1fae5", border: "#a7f3d0" },
  };

  const groupedByDay = filtered.reduce((acc, a) => {
    const day = new Date(a.created_at).toLocaleDateString();
    (acc[day] = acc[day] || []).push(a);
    return acc;
  }, {});

  return (
    <div className="px-6 lg:px-14 py-10 min-h-[80vh]" data-testid="alerts-page">
      <div className="eyebrow flex items-center gap-2"><Bell size={12} /> ALERT CENTER</div>
      <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
        Every anomaly, in one <span className="text-[color:var(--brand-3)]">inbox.</span>
      </h1>
      <p className="text-[color:var(--ink-3)] text-sm mt-2 max-w-xl">
        Auto-alerts fired from live monitoring — filter by severity, asset code and time window.
      </p>

      <div className="gs-card p-4 mt-8 flex flex-wrap items-center gap-3" data-testid="alerts-filters">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[color:var(--brand-3)]" />
          <span className="text-[10px] font-mono text-[color:var(--ink-3)]">FILTER</span>
        </div>
        {SEVERITIES.map((s) => (
          <button
            key={s} onClick={() => setSeverity(s)}
            data-testid={`alerts-sev-${s}`}
            className={`text-[10px] font-mono px-2 py-1 rounded-full border transition ${severity === s ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]" : "border-[color:var(--line)] text-[color:var(--ink-3)]"}`}
          >
            {s.toUpperCase()}
          </button>
        ))}
        <div className="w-px h-5 bg-[color:var(--line)]" />
        {RANGES.map((r) => (
          <button
            key={r.hours} onClick={() => setHours(r.hours)}
            data-testid={`alerts-range-${r.hours}`}
            className={`text-[10px] font-mono px-2 py-1 rounded-full border transition ${hours === r.hours ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]" : "border-[color:var(--line)] text-[color:var(--ink-3)]"}`}
          >
            {r.label.toUpperCase()}
          </button>
        ))}
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by asset code..."
          data-testid="alerts-search"
          className="gs-input text-xs" style={{ padding: "6px 10px", width: 200 }}
        />
        <span className="ml-auto text-[10px] font-mono text-[color:var(--ink-3)]" data-testid="alerts-count">
          {filtered.length} RESULT{filtered.length === 1 ? "" : "S"}
        </span>
      </div>

      {loading ? (
        <div className="text-[color:var(--ink-3)] text-sm mt-8">Loading alerts...</div>
      ) : filtered.length === 0 ? (
        <div className="gs-card p-10 mt-6 text-center" data-testid="alerts-empty">
          <CheckCircle2 size={28} className="mx-auto text-[color:var(--brand-3)]" />
          <div className="text-sm text-[color:var(--ink-2)] mt-3">No alerts match your filters. Systems look calm.</div>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {Object.entries(groupedByDay).map(([day, list]) => (
            <div key={day}>
              <div className="text-[10px] font-mono text-[color:var(--ink-3)] mb-2">{day}</div>
              <div className="gs-card p-2 divide-y divide-[color:var(--line-2)]">
                {list.map((a) => (
                  <div key={a.id} className="p-4 flex items-center gap-3" data-testid={`alert-${a.code}`}>
                    <AlertTriangle size={16} className="text-[color:var(--amber)]" />
                    <span className="font-mono text-[10px] text-[color:var(--brand-3)]">{a.code}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[color:var(--ink)] truncate">{a.title}</div>
                      <div className="text-[10px] font-mono text-[color:var(--ink-3)] mt-1">
                        {new Date(a.created_at).toLocaleTimeString()} · confidence {a.confidence}%
                      </div>
                    </div>
                    <span className="text-[10px] font-mono border rounded-full px-2 py-1"
                      style={sevColor[a.severity]}>
                      {a.severity.toUpperCase()}
                    </span>
                    {a.acknowledged ? (
                      <span className="text-[10px] font-mono text-[color:var(--brand-3)]">ACKED</span>
                    ) : (
                      <button
                        onClick={() => ack(a.id)}
                        data-testid={`alert-ack-${a.code}`}
                        className="text-[10px] font-mono px-2 py-1 rounded-full border border-[color:var(--line)] hover:border-[color:var(--brand)] hover:text-[color:var(--brand-3)] transition"
                      >
                        ACKNOWLEDGE
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
