import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { ChevronRight, Search, MapPin, AlertTriangle, Loader2 } from "lucide-react";

/** Sites table backed by /api/fleet/sites — sortable, searchable, category-filtered */
export default function SitesTable({ category }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [limit] = useState(20);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const params = { limit };
    if (category) params.category = category;
    if (search.trim()) params.search = search.trim();
    api.get("/fleet/sites", { params })
      .then(({ data }) => {
        if (!mounted) return;
        setRows(data.items);
        setTotal(data.total);
      })
      .catch(() => mounted && setRows([]))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [category, search, limit]);

  const badge = (pr) => {
    if (pr == null) return { color: "#687870", bg: "#edf2ef" };
    if (pr >= 95) return { color: "#087346", bg: "#dff5e9" };
    if (pr >= 85) return { color: "#b45309", bg: "#fef3c7" };
    return { color: "#b91c1c", bg: "#fee2e2" };
  };

  return (
    <div className="gs-card p-6" data-testid="sites-table">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="font-mono text-[10px] text-[color:var(--ink-3)]">SITES · {category || "ALL CATEGORIES"}</div>
          <div className="text-sm text-[color:var(--ink)] mt-1">
            {total.toLocaleString()} sites · showing top {Math.min(limit, rows.length)}
          </div>
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-3)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search site id / name..."
            data-testid="sites-search"
            className="gs-input text-xs pl-8"
            style={{ padding: "8px 12px 8px 30px", width: 240 }}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-[color:var(--ink-3)] text-sm flex items-center justify-center gap-2">
          <Loader2 className="animate-spin" size={14} /> Loading sites...
        </div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-[color:var(--ink-3)] text-sm" data-testid="sites-empty">
          No sites match this filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono text-[color:var(--ink-3)] border-b border-[color:var(--line-2)]">
                <th className="text-left py-2 px-2">SITE</th>
                <th className="text-left py-2 px-2">STATE</th>
                <th className="text-right py-2 px-2">CAPACITY (kW)</th>
                <th className="text-right py-2 px-2">PR%</th>
                <th className="text-right py-2 px-2">AVAIL%</th>
                <th className="text-right py-2 px-2">ALARMS</th>
                <th className="text-right py-2 px-2">$ LOSS</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const prb = badge(s.latest_performance_ratio_pct);
                return (
                  <tr
                    key={s.site_id}
                    className="border-b border-[color:var(--line-2)] hover:bg-[color:var(--brand-mint)] transition"
                    data-testid={`site-row-${s.site_id}`}
                  >
                    <td className="py-2 px-2">
                      <Link to={`/site/${s.site_id}`} className="block">
                        <div className="font-mono text-[11px] text-[color:var(--brand-3)]">{s.site_id}</div>
                        <div className="text-xs text-[color:var(--ink)] truncate max-w-[220px]">{s.site_name}</div>
                        <div className="text-[10px] text-[color:var(--ink-3)]">{s.site_type}</div>
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-xs text-[color:var(--ink-2)]">
                      <span className="inline-flex items-center gap-1"><MapPin size={10} /> {s.state}</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-xs text-[color:var(--ink)]">
                      {s.site_capacity_kW?.toFixed?.(1) ?? "—"}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span
                        className="inline-block font-mono text-[10px] px-2 py-0.5 rounded-full"
                        style={{ color: prb.color, background: prb.bg }}
                      >
                        {s.latest_performance_ratio_pct != null ? `${s.latest_performance_ratio_pct.toFixed(1)}%` : "—"}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-xs text-[color:var(--ink-2)]">
                      {s.latest_availability_pct != null ? `${s.latest_availability_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {s.open_alarms > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-mono text-[color:var(--coral)]">
                          <AlertTriangle size={10} /> {s.open_alarms}
                          {s.high_sev_alarms > 0 && <span className="text-[9px] text-[color:var(--ink-3)]">/{s.high_sev_alarms}H</span>}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-[color:var(--ink-3)]">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-xs text-[color:var(--ink-2)]">
                      {s.latest_revenue_loss_usd ? `$${s.latest_revenue_loss_usd.toFixed(0)}` : "—"}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <Link to={`/site/${s.site_id}`} data-testid={`site-open-${s.site_id}`}>
                        <ChevronRight size={14} className="text-[color:var(--ink-3)] hover:text-[color:var(--brand-3)]" />
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
  );
}
