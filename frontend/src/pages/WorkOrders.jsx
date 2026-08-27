import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Wrench, Loader2, ArrowRight, Filter } from "lucide-react";

const STATUS_STYLES = {
  Created:    { color: "#687870", bg: "#edf2ef", border: "#dfe8e3" },
  Assigned:   { color: "#1e40af", bg: "#dbeafe", border: "#bfdbfe" },
  Dispatched: { color: "#b45309", bg: "#fef3c7", border: "#fde68a" },
  Resolved:   { color: "#087346", bg: "#dff5e9", border: "#a7f3d0" },
};

const STATUS_ORDER = ["Created", "Assigned", "Dispatched", "Resolved"];

/** Work Orders board — full-page WO list with status filter + drill-in. */
export default function WorkOrders() {
  const [data, setData] = useState({ items: [], total: 0, status_breakdown: [] });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const params = { limit: 200 };
    if (status) params.status = status;
    api.get("/fleet/work-orders", { params })
      .then(({ data }) => mounted && setData(data))
      .catch(() => mounted && setData({ items: [], total: 0, status_breakdown: [] }))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [status]);

  return (
    <div className="px-6 lg:px-14 py-10 max-w-full overflow-x-hidden" data-testid="work-orders-page">
      <div className="eyebrow flex items-center gap-2">
        <Wrench size={12} /> WORK ORDERS
      </div>
      <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
        {data.total} work orders <span className="text-[color:var(--brand-3)]">
          {status ? `· ${status.toLowerCase()}` : ""}
        </span>
      </h1>
      <p className="text-[color:var(--ink-3)] text-sm mt-2">
        Detect → Diagnose → Dispatch → Resolve. Tap any row to jump to the site.
      </p>

      {/* Status breakdown — driven by actual backend data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        {STATUS_ORDER.map((s) => {
          const bd = data.status_breakdown.find((x) => x.status === s);
          if (!bd && !status) return null;
          const style = STATUS_STYLES[s] || STATUS_STYLES.Created;
          const on = status === s;
          return (
            <button
              key={s}
              onClick={() => setStatus(on ? "" : s)}
              data-testid={`wo-status-${s}`}
              className="gs-card p-5 text-left transition"
              style={on ? { borderColor: style.color, background: style.bg } : {}}
            >
              <div className="text-[10px] font-mono" style={{ color: style.color }}>
                {s.toUpperCase()}
              </div>
              <div className="font-display text-3xl mt-2" style={{ color: style.color }}>
                {bd?.count ?? 0}
              </div>
              <div className="text-[11px] text-[color:var(--ink-3)] mt-1">
                {on ? "Filter active — tap to clear" : "Tap to filter"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="gs-card p-6 mt-8" data-testid="wo-table">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-mono text-[10px] text-[color:var(--ink-3)]">
              WORK ORDER LIST · {data.items.length} shown
            </div>
            <div className="text-sm text-[color:var(--ink)] mt-1">Newest first</div>
          </div>
          {status && (
            <button
              onClick={() => setStatus("")}
              data-testid="wo-clear-filter"
              className="text-[11px] font-mono text-[color:var(--brand-3)] hover:underline inline-flex items-center gap-1"
            >
              <Filter size={11} /> CLEAR
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-10 text-center text-[color:var(--ink-3)] text-sm flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={14} /> Loading work orders...
          </div>
        ) : data.items.length === 0 ? (
          <div className="py-10 text-center text-[color:var(--ink-3)] text-sm">
            No work orders match this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-mono text-[color:var(--ink-3)] border-b border-[color:var(--line-2)]">
                  <th className="text-left py-2 px-2">WO</th>
                  <th className="text-left py-2 px-2">SITE</th>
                  <th className="text-left py-2 px-2">TRADE</th>
                  <th className="text-left py-2 px-2">RESOLUTION</th>
                  <th className="text-right py-2 px-2">HOURS</th>
                  <th className="text-right py-2 px-2">PARTS $</th>
                  <th className="text-right py-2 px-2">STATUS</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((wo) => {
                  const st = STATUS_STYLES[wo.status] || STATUS_STYLES.Created;
                  return (
                    <tr key={wo.work_order_id} className="border-b border-[color:var(--line-2)] hover:bg-[color:var(--brand-mint)]" data-testid={`wo-row-${wo.work_order_id}`}>
                      <td className="py-2 px-2 font-mono text-[11px] text-[color:var(--brand-3)]">{wo.work_order_id}</td>
                      <td className="py-2 px-2 text-xs">
                        <Link to={`/site/${wo.site_id}`} className="text-[color:var(--ink)] hover:text-[color:var(--brand-3)]">
                          {wo.site_id}
                        </Link>
                      </td>
                      <td className="py-2 px-2 text-xs text-[color:var(--ink-2)]">{wo.trade}</td>
                      <td className="py-2 px-2 text-xs text-[color:var(--ink)] max-w-md truncate">{wo.resolution_action}</td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-[color:var(--ink-2)]">{wo.labor_hours}h</td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-[color:var(--ink-2)]">${wo.parts_cost_usd}</td>
                      <td className="py-2 px-2 text-right">
                        <span
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                          style={{ color: st.color, background: st.bg }}
                        >
                          {wo.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <Link to={`/site/${wo.site_id}`} data-testid={`wo-open-${wo.work_order_id}`}>
                          <ArrowRight size={14} className="text-[color:var(--ink-3)] hover:text-[color:var(--brand-3)]" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
