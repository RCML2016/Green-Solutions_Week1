import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Wrench, Loader2 } from "lucide-react";

const STATUS_COLORS = {
  Created:    { color: "#687870", bg: "#edf2ef" },
  Dispatched: { color: "#b45309", bg: "#fef3c7" },
  Resolved:   { color: "#087346", bg: "#dff5e9" },
};

/** Work order board from /api/fleet/work-orders */
export default function WorkOrdersCard({ category = "" }) {
  const [data, setData] = useState({ items: [], total: 0, status_breakdown: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const params = { limit: 8 };
    if (category) params.category = category;
    api.get("/fleet/work-orders", { params })
      .then(({ data }) => mounted && setData(data))
      .catch(() => mounted && setData({ items: [], total: 0, status_breakdown: [] }))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [category]);

  return (
    <div className="gs-card p-6" data-testid="work-orders-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-mono text-[10px] text-[color:var(--ink-3)]">WORK ORDERS · {category || "ALL CATEGORIES"}</div>
          <div className="text-sm text-[color:var(--ink)] mt-1">{data.total} total work orders</div>
        </div>
        <Wrench size={14} className="text-[color:var(--brand-3)]" />
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {data.status_breakdown.map((s) => {
          const st = STATUS_COLORS[s.status] || { color: "#687870", bg: "#edf2ef" };
          return (
            <div
              key={s.status}
              className="rounded-xl p-3 text-center border border-[color:var(--line-2)]"
              style={{ background: st.bg }}
              data-testid={`wo-status-${s.status}`}
            >
              <div className="text-xs font-mono" style={{ color: st.color }}>{s.status.toUpperCase()}</div>
              <div className="font-display text-2xl mt-1" style={{ color: st.color }}>{s.count}</div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="py-6 text-center text-[color:var(--ink-3)] text-sm flex items-center justify-center gap-2">
          <Loader2 className="animate-spin" size={14} /> Loading...
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.items.map((wo) => {
            const st = STATUS_COLORS[wo.status] || STATUS_COLORS.Created;
            return (
              <div key={wo.work_order_id} className="flex items-center gap-2 text-xs py-1.5 border-b border-[color:var(--line-2)] last:border-0">
                <span className="font-mono text-[10px] text-[color:var(--brand-3)]">{wo.work_order_id}</span>
                <span className="flex-1 text-[color:var(--ink)] truncate">{wo.resolution_action}</span>
                <span className="font-mono text-[10px] text-[color:var(--ink-3)]">{wo.trade}</span>
                <span
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                  style={{ color: st.color, background: st.bg }}
                >
                  {wo.status.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
