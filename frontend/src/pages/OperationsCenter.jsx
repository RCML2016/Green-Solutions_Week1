import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Activity, AlertTriangle, Wrench, Users as UsersIcon, Loader2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import AlarmsFeed from "@/components/dashboard/AlarmsFeed";
import WorkOrdersCard from "@/components/dashboard/WorkOrdersCard";

/**
 * Operations Center — O&M Manager's primary workspace.
 * Focus: alarms + work orders + SLA / MTTR summary.
 */
export default function OperationsCenter() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [alarmStats, setAlarmStats] = useState(null);
  const [woStats, setWoStats] = useState(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get("/fleet/kpis"),
      api.get("/fleet/alarms", { params: { limit: 1 } }),
      api.get("/fleet/work-orders", { params: { limit: 1 } }),
    ])
      .then(([k, a, w]) => {
        if (!mounted) return;
        setKpis(k.data);
        setAlarmStats(a.data);
        setWoStats(w.data);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  if (!kpis) {
    return (
      <div className="px-6 lg:px-14 py-16 flex items-center gap-2 text-[color:var(--ink-3)]">
        <Loader2 className="animate-spin" size={14} /> Loading operations…
      </div>
    );
  }

  const detectRatio = alarmStats
    ? ((alarmStats.total - kpis.alarms_open) / Math.max(1, alarmStats.total) * 100)
    : 0;
  // Average MTTR proxy from top-level durations already surfaced elsewhere; use lost_kWh as impact proxy.

  return (
    <div className="px-6 lg:px-14 py-10 max-w-full overflow-x-hidden" data-testid="operations-page">
      <div className="eyebrow flex items-center gap-2">
        <Activity size={12} /> OPERATIONS CENTER
      </div>
      <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
        Detect · Diagnose · Assign · <span className="text-[color:var(--brand-3)]">Resolve</span>
      </h1>
      <p className="text-[color:var(--ink-3)] text-sm mt-2">
        {kpis.alarms_open} open alarms across {kpis.site_count} sites · {kpis.work_orders_open} open work orders.
      </p>

      {/* Ops KPIs */}
      <div className="grid md:grid-cols-4 gap-4 mt-8">
        <div className="gs-card p-5" data-testid="ops-kpi-open-alarms">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            OPEN ALARMS <AlertTriangle size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">{kpis.alarms_open}</div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">{kpis.alarms_high} high severity</div>
        </div>
        <div className="gs-card p-5" data-testid="ops-kpi-open-wo">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            OPEN WORK ORDERS <Wrench size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">{kpis.work_orders_open}</div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">Dispatched + Created</div>
        </div>
        <div className="gs-card p-5" data-testid="ops-kpi-detection">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            RESOLUTION RATE <Activity size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">
            {detectRatio.toFixed(0)}<span className="text-lg text-[color:var(--ink-3)]">%</span>
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">of alarms closed</div>
        </div>
        <div className="gs-card p-5" data-testid="ops-kpi-loss">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            REVENUE AT RISK <UsersIcon size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">
            ${kpis.total_revenue_loss_usd.toFixed(0)}
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">across open incidents</div>
        </div>
      </div>

      {/* Alarms + WOs */}
      <div className="grid lg:grid-cols-2 gap-6 mt-8">
        <AlarmsFeed />
        <WorkOrdersCard />
      </div>

      {/* Quick jump */}
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        <Link to="/dashboard" className="gs-card p-5 hover:border-[color:var(--brand)] transition" data-testid="ops-cta-fleet">
          <div className="font-mono text-[10px] text-[color:var(--ink-3)]">FULL FLEET DASHBOARD</div>
          <div className="font-display text-xl text-[color:var(--ink)] mt-2">Every site · every asset →</div>
        </Link>
        <Link to="/alerts" className="gs-card p-5 hover:border-[color:var(--brand)] transition" data-testid="ops-cta-alerts">
          <div className="font-mono text-[10px] text-[color:var(--ink-3)]">ALERT CENTER</div>
          <div className="font-display text-xl text-[color:var(--ink)] mt-2">Group by day · acknowledge →</div>
        </Link>
        {user?.role === "admin" ? (
          <Link to="/team" className="gs-card p-5 hover:border-[color:var(--brand)] transition" data-testid="ops-cta-team">
            <div className="font-mono text-[10px] text-[color:var(--ink-3)]">TEAM & SLA</div>
            <div className="font-display text-xl text-[color:var(--ink)] mt-2">Invite technicians →</div>
          </Link>
        ) : (
          <Link to="/reports" className="gs-card p-5 hover:border-[color:var(--brand)] transition" data-testid="ops-cta-reports">
            <div className="font-mono text-[10px] text-[color:var(--ink-3)]">REPORTS</div>
            <div className="font-display text-xl text-[color:var(--ink)] mt-2">Weekly digest & PDFs →</div>
          </Link>
        )}
      </div>
    </div>
  );
}
