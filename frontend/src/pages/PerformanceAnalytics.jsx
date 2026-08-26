import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import {
  LineChart, TrendingDown, CloudSun, Database, ArrowRight, Loader2, Filter,
} from "lucide-react";

/**
 * Performance Engineer workspace.
 * Focus: loss analysis, site benchmarking, weather correlation, data quality.
 */
export default function PerformanceAnalytics() {
  const [kpis, setKpis] = useState(null);
  const [sites, setSites] = useState([]);
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [rootCauses, setRootCauses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const params = { limit: 100 };
    if (category) params.category = category;
    Promise.all([
      api.get("/fleet/kpis", { params: category ? { category } : {} }),
      api.get("/fleet/sites", { params }),
      api.get("/fleet/categories"),
      api.get("/fleet/alarms", { params: { limit: 1, ...(category ? { category } : {}) } }),
    ])
      .then(([k, s, c, a]) => {
        if (!mounted) return;
        setKpis(k.data);
        setSites(s.data.items);
        setCategories(c.data);
        setRootCauses(a.data.root_causes || []);
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [category]);

  // Benchmarking: sort sites by PR% ascending (worst first)
  const ranked = useMemo(() => {
    return [...sites]
      .filter((s) => s.latest_performance_ratio_pct != null)
      .sort((a, b) => (a.latest_performance_ratio_pct ?? 0) - (b.latest_performance_ratio_pct ?? 0));
  }, [sites]);

  // Data quality: sites with null perf / null alarms / degradation NaN
  const dq = useMemo(() => {
    const total = sites.length;
    const missingPR = sites.filter((s) => s.latest_performance_ratio_pct == null).length;
    const missingAvail = sites.filter((s) => s.latest_availability_pct == null).length;
    const noAlarms = sites.filter((s) => s.open_alarms === 0 && s.high_sev_alarms === 0).length;
    return { total, missingPR, missingAvail, noAlarms };
  }, [sites]);

  if (loading || !kpis) {
    return (
      <div className="px-6 lg:px-14 py-16 flex items-center gap-2 text-[color:var(--ink-3)]">
        <Loader2 className="animate-spin" size={14} /> Loading analytics…
      </div>
    );
  }

  const yieldPct = kpis.expected_kWh_day > 0
    ? (kpis.actual_kWh_day / kpis.expected_kWh_day * 100) : 0;

  return (
    <div className="px-6 lg:px-14 py-10 max-w-full overflow-x-hidden" data-testid="performance-page">
      <div className="eyebrow flex items-center gap-2">
        <LineChart size={12} /> PERFORMANCE ANALYTICS
      </div>
      <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
        Loss analysis · <span className="text-[color:var(--brand-3)]">root cause</span>
      </h1>
      <p className="text-[color:var(--ink-3)] text-sm mt-2">
        {kpis.site_count} sites · yield {yieldPct.toFixed(1)}% · {(kpis.total_lost_kWh / 1000).toFixed(1)} MWh lost today.
      </p>

      {/* Category filter */}
      <div className="mt-6 flex flex-wrap gap-2 items-center" data-testid="perf-category-filter">
        <span className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center gap-1">
          <Filter size={11} /> FILTER
        </span>
        <button
          onClick={() => setCategory("")}
          data-testid="perf-cat-all"
          className={`text-[11px] font-mono px-3 py-1.5 rounded-full border transition ${!category ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]" : "border-[color:var(--line)] text-[color:var(--ink-2)]"}`}
        >
          ALL
        </button>
        {categories.filter((c) => c.site_count > 0).map((c) => (
          <button
            key={c.category}
            onClick={() => setCategory(c.category)}
            data-testid={`perf-cat-${c.priority}`}
            className={`text-[11px] font-mono px-3 py-1.5 rounded-full border transition ${category === c.category ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]" : "border-[color:var(--line)] text-[color:var(--ink-2)]"}`}
          >
            {c.category}
          </button>
        ))}
      </div>

      {/* Analytics KPIs */}
      <div className="grid md:grid-cols-4 gap-4 mt-6">
        <div className="gs-card p-5" data-testid="perf-kpi-yield">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            ENERGY YIELD <TrendingDown size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">
            {yieldPct.toFixed(1)}<span className="text-lg text-[color:var(--ink-3)]">%</span>
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">Actual vs expected</div>
        </div>
        <div className="gs-card p-5" data-testid="perf-kpi-degradation">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            AVG DEGRADATION <LineChart size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">
            {kpis.avg_degradation_pct.toFixed(2)}<span className="text-lg text-[color:var(--ink-3)]">%</span>
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">Annualised</div>
        </div>
        <div className="gs-card p-5" data-testid="perf-kpi-losses">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            LOST ENERGY <TrendingDown size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">
            {(kpis.total_lost_kWh / 1000).toFixed(1)}<span className="text-lg text-[color:var(--ink-3)]"> MWh</span>
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">
            ${kpis.total_revenue_loss_usd.toFixed(0)} revenue at risk
          </div>
        </div>
        <div className="gs-card p-5" data-testid="perf-kpi-dq">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            DATA COMPLETENESS <Database size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">
            {dq.total ? Math.round(((dq.total - dq.missingPR) / dq.total) * 100) : 100}<span className="text-lg text-[color:var(--ink-3)]">%</span>
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">
            {dq.missingPR} sites missing PR
          </div>
        </div>
      </div>

      {/* Benchmarking table + root cause pareto */}
      <div className="grid lg:grid-cols-2 gap-6 mt-8">
        {/* Benchmarking (worst 15) */}
        <div className="gs-card p-6" data-testid="perf-benchmark">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-mono text-[10px] text-[color:var(--ink-3)]">SITE BENCHMARKING · WORST PR%</div>
              <div className="text-sm text-[color:var(--ink)] mt-1">Bottom 15 of {ranked.length} sites</div>
            </div>
            <Link to="/dashboard" className="text-[11px] font-mono text-[color:var(--brand-3)] hover:underline inline-flex items-center gap-1">
              Full fleet <ArrowRight size={11} />
            </Link>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {ranked.slice(0, 15).map((s) => {
              const pr = s.latest_performance_ratio_pct;
              const width = Math.max(4, Math.min(100, pr || 0));
              return (
                <Link
                  key={s.site_id}
                  to={`/site/${s.site_id}`}
                  className="block"
                  data-testid={`perf-benchmark-${s.site_id}`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[color:var(--brand-3)]">{s.site_id}</span>
                    <span className="text-[color:var(--ink-2)] truncate max-w-[180px]">{s.site_type}</span>
                    <span className="font-mono text-[color:var(--ink)]">{pr?.toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[color:var(--bg-3)] overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${width}%`,
                        background: pr < 85 ? "#b91c1c" : pr < 95 ? "#d97706" : "var(--brand)",
                      }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Root cause pareto */}
        <div className="gs-card p-6" data-testid="perf-root-causes">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-mono text-[10px] text-[color:var(--ink-3)]">ROOT CAUSE PARETO</div>
              <div className="text-sm text-[color:var(--ink)] mt-1">By alarm frequency</div>
            </div>
            <CloudSun size={14} className="text-[color:var(--brand-3)]" />
          </div>
          {rootCauses.length === 0 ? (
            <div className="text-[color:var(--ink-3)] text-sm">No alarms in this filter.</div>
          ) : (
            <div className="space-y-2">
              {rootCauses.slice(0, 10).map((rc, i) => {
                const max = rootCauses[0].count;
                const pct = Math.round((rc.count / max) * 100);
                return (
                  <div key={rc.root_cause} data-testid={`perf-rc-${i}`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[color:var(--ink-2)]">{rc.root_cause}</span>
                      <span className="font-mono text-[color:var(--ink)]">{rc.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-[color:var(--bg-3)] overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${pct}%`,
                          background: i < 3 ? "#b91c1c" : i < 6 ? "#d97706" : "var(--brand)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Data quality summary */}
      <div className="gs-card p-6 mt-6" data-testid="perf-data-quality">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-mono text-[10px] text-[color:var(--ink-3)]">DATA QUALITY</div>
            <div className="text-sm text-[color:var(--ink)] mt-1">Coverage across {dq.total} sites in view</div>
          </div>
          <Database size={14} className="text-[color:var(--brand-3)]" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <DqTile label="Missing PR" value={dq.missingPR} total={dq.total} inverted testid="dq-missing-pr" />
          <DqTile label="Missing Availability" value={dq.missingAvail} total={dq.total} inverted testid="dq-missing-avail" />
          <DqTile label="Sites w/ no open alarms" value={dq.noAlarms} total={dq.total} testid="dq-no-alarms" />
        </div>
      </div>
    </div>
  );
}

function DqTile({ label, value, total, inverted, testid }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  const good = inverted ? pct < 20 : pct > 50;
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: good ? "var(--brand)" : "#fde68a",
        background: good ? "var(--brand-tint)" : "#fef3c7",
      }}
      data-testid={testid}
    >
      <div className="text-[10px] font-mono text-[color:var(--ink-3)]">{label}</div>
      <div className="font-display text-2xl mt-1 text-[color:var(--ink)]">
        {value}<span className="text-sm text-[color:var(--ink-3)]"> / {total}</span>
      </div>
      <div className="text-[11px] mt-1" style={{ color: good ? "var(--brand-3)" : "#b45309" }}>
        {pct}%
      </div>
    </div>
  );
}
