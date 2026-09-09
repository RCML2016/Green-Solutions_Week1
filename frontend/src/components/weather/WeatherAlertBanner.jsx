import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CloudLightning, X } from "lucide-react";
import { api } from "@/lib/api";

const RISK_STYLE = {
  "Storm Risk": { color: "#b91c1c", bg: "#fee2e2", border: "#fecaca" },
  "Heat Risk": { color: "#b45309", bg: "#fef3c7", border: "#fde68a" },
  "Storm & Heat Risk": { color: "#b91c1c", bg: "#fee2e2", border: "#fecaca" },
};

/** In-app banner flagging high-priority sites facing severe weather (storm /
 * extreme heat) in the next 48h. Dismissible for the current session. */
export default function WeatherAlertBanner() {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.get("/fleet/weather/alerts")
      .then(({ data }) => mounted && setAlerts(data.alerts || []))
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  if (dismissed || alerts.length === 0) return null;
  const VISIBLE = 6;
  const shown = expanded ? alerts : alerts.slice(0, VISIBLE);
  const hiddenCount = alerts.length - shown.length;

  return (
    <div
      className="rounded-2xl border p-4 mb-6 flex items-start gap-3"
      style={{ borderColor: "#fecaca", background: "#fef2f2" }}
      data-testid="weather-alert-banner"
    >
      <CloudLightning size={18} className="mt-0.5 shrink-0" style={{ color: "#b91c1c" }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[color:var(--ink)]">
          {alerts.length} high-priority site{alerts.length > 1 ? "s" : ""} facing severe weather in the next 48h
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {shown.map((a) => {
            const style = RISK_STYLE[a.risk_label] || RISK_STYLE["Storm Risk"];
            return (
              <Link
                key={a.site_id}
                to={`/site/${a.site_id}`}
                data-testid={`weather-alert-${a.site_id}`}
                className="inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border transition hover:opacity-80"
                style={{ color: style.color, background: style.bg, borderColor: style.border }}
              >
                {a.site_id} · {a.risk_label}
              </Link>
            );
          })}
          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              data-testid="weather-alert-show-more"
              className="text-xs rounded-full px-3 py-1 border border-[color:var(--line)] text-[color:var(--ink-2)] hover:border-[color:var(--brand)] transition"
            >
              +{hiddenCount} more
            </button>
          )}
          {expanded && alerts.length > VISIBLE && (
            <button
              onClick={() => setExpanded(false)}
              data-testid="weather-alert-show-less"
              className="text-xs rounded-full px-3 py-1 border border-[color:var(--line)] text-[color:var(--ink-2)] hover:border-[color:var(--brand)] transition"
            >
              Show less
            </button>
          )}
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        data-testid="weather-alert-dismiss"
        className="p-1 rounded hover:bg-white/60 text-[color:var(--ink-3)] shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}
