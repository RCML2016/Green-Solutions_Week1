import { Activity, Zap, AlertTriangle, Wrench, TrendingUp, Battery, Sparkles } from "lucide-react";

/** Fleet KPI cards backed by real dataset via /api/fleet/kpis */
export default function FleetKpiCards({ kpis, pulse }) {
  const cards = [
    {
      label: "TOTAL CAPACITY",
      value: `${kpis.total_capacity_MW.toFixed(2)} MW`,
      sub: `${kpis.site_count} sites · ${kpis.asset_count.toLocaleString()} assets`,
      icon: Battery,
      testid: "kpi-capacity",
    },
    {
      label: "PERFORMANCE RATIO",
      value: `${kpis.avg_performance_ratio_pct.toFixed(1)}%`,
      sub: `Availability ${kpis.avg_availability_pct.toFixed(1)}%`,
      icon: TrendingUp,
      testid: "kpi-pr",
    },
    {
      label: "ENERGY TODAY",
      value: `${(kpis.actual_kWh_day / 1000).toFixed(1)} MWh`,
      sub: `Expected ${(kpis.expected_kWh_day / 1000).toFixed(1)} MWh`,
      icon: Zap,
      testid: "kpi-energy",
    },
    {
      label: "OPEN ALARMS",
      value: String(kpis.alarms_open).padStart(2, "0"),
      sub: `${kpis.alarms_high} high severity`,
      icon: AlertTriangle,
      testid: "kpi-alarms",
    },
    {
      label: "WORK ORDERS",
      value: String(kpis.work_orders_open).padStart(2, "0"),
      sub: "Currently open",
      icon: Wrench,
      testid: "kpi-work-orders",
    },
    {
      label: "REVENUE LOSS",
      value: `$${kpis.total_revenue_loss_usd.toFixed(0)}`,
      sub: `${kpis.total_lost_kWh.toFixed(0)} kWh lost`,
      icon: Sparkles,
      testid: "kpi-loss",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="gs-card p-5" data-testid={c.testid}>
          <div className="flex items-center justify-between text-[10px] font-mono text-[color:var(--ink-3)]">
            <span>{c.label}</span>
            <c.icon size={14} className="text-[color:var(--brand-3)]" />
          </div>
          <div className={`font-display text-2xl mt-3 transition ${pulse ? "text-[color:var(--brand-3)]" : "text-[color:var(--ink)]"}`}>
            {c.value}
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
