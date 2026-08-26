import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { AlertTriangle, Loader2 } from "lucide-react";

const SEV_STYLE = {
  Critical:{ color: "#7f1d1d", bg: "#fecaca", border: "#f87171" },
  High:    { color: "#b91c1c", bg: "#fee2e2", border: "#fecaca" },
  Medium:  { color: "#b45309", bg: "#fef3c7", border: "#fde68a" },
  Low:     { color: "#087346", bg: "#dff5e9", border: "#a7f3d0" },
};

/** Real alarm feed from /api/fleet/alarms with root-cause breakdown */
export default function AlarmsFeed({ category = "" }) {
  const [data, setData] = useState({ items: [], total: 0, root_causes: [] });
  const [severity, setSeverity] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const params = { limit: 15 };
    if (severity) params.severity = severity;
    if (category) params.category = category;
    api.get("/fleet/alarms", { params })
      .then(({ data }) => mounted && setData(data))
      .catch(() => mounted && setData({ items: [], total: 0, root_causes: [] }))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [severity, category]);

  return (
    <div className="gs-card p-6" data-testid="alarms-feed">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-mono text-[10px] text-[color:var(--ink-3)]">
            ALARM STREAM · {category || "ALL CATEGORIES"}
          </div>
          <div className="text-sm text-[color:var(--ink)] mt-1">{data.total} matching alarms</div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["", "Critical", "High", "Medium", "Low"].map((s) => (
            <button
              key={s || "all"}
              onClick={() => setSeverity(s)}
              data-testid={`alarms-sev-${s || "all"}`}
              className={`text-[10px] font-mono px-2 py-1 rounded-full border transition ${
                severity === s
                  ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]"
                  : "border-[color:var(--line)] text-[color:var(--ink-3)]"
              }`}
            >
              {s ? s.toUpperCase() : "ALL"}
            </button>
          ))}
        </div>
      </div>

      {/* Root cause pill row */}
      {data.root_causes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {data.root_causes.slice(0, 6).map((rc) => (
            <span
              key={rc.root_cause}
              className="text-[10px] font-mono px-2 py-1 rounded-full bg-[color:var(--bg-3)] text-[color:var(--ink-2)] border border-[color:var(--line-2)]"
              data-testid={`root-cause-${rc.root_cause}`}
            >
              {rc.root_cause} · {rc.count}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-[color:var(--ink-3)] text-sm flex items-center justify-center gap-2">
          <Loader2 className="animate-spin" size={14} /> Loading alarms...
        </div>
      ) : data.items.length === 0 ? (
        <div className="py-8 text-center text-[color:var(--ink-3)] text-sm">No matching alarms.</div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {data.items.map((a) => {
            const sv = SEV_STYLE[a.severity] || SEV_STYLE.Low;
            return (
              <div
                key={a.alarm_id}
                className="border border-[color:var(--line-2)] rounded-xl p-3 hover:border-[color:var(--brand)] transition"
                data-testid={`alarm-${a.alarm_id}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="p-1.5 rounded-lg"
                    style={{ background: sv.bg, color: sv.color }}
                  >
                    <AlertTriangle size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] text-[color:var(--brand-3)]">{a.alarm_id}</span>
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border"
                        style={{ color: sv.color, background: sv.bg, borderColor: sv.border }}
                      >
                        {a.severity.toUpperCase()}
                      </span>
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded-full text-[color:var(--ink-3)] border border-[color:var(--line-2)]"
                      >
                        {a.status}
                      </span>
                    </div>
                    <div className="text-sm text-[color:var(--ink)] mt-1">{a.root_cause_category}</div>
                    <div className="text-[10px] font-mono text-[color:var(--ink-3)] mt-0.5">
                      {a.site_id} · {a.asset_id} · {new Date(a.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-[color:var(--ink-3)]">DURATION</div>
                    <div className="font-mono text-xs text-[color:var(--ink)]">{a.duration_hours}h</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
