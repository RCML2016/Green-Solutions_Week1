import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import {
  Briefcase, TrendingUp, Leaf, DollarSign, AlertTriangle, ArrowRight, Loader2, Sparkles,
} from "lucide-react";

/**
 * Executive Overview — high-level portfolio KPIs, ESG headline, top risks.
 * Read-only summary; every card links to the deeper page.
 */
export default function ExecutiveOverview() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [categories, setCategories] = useState([]);
  const [topAlarms, setTopAlarms] = useState([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get("/fleet/kpis"),
      api.get("/fleet/categories"),
      api.get("/fleet/alarms", { params: { severity: "Critical", limit: 5 } }),
    ])
      .then(([k, c, a]) => {
        if (!mounted) return;
        setKpis(k.data);
        setCategories(c.data);
        setTopAlarms(a.data.items);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  if (!kpis) {
    return (
      <div className="px-6 lg:px-14 py-16 flex items-center gap-2 text-[color:var(--ink-3)]">
        <Loader2 className="animate-spin" size={14} /> Loading portfolio overview…
      </div>
    );
  }

  // Approximate CO2 avoided (0.5 kg CO2/kWh grid displacement)
  const co2AvoidedTonnes = ((kpis.actual_kWh_day * 365) / 1000) * 0.5 / 1000;

  return (
    <div className="px-6 lg:px-14 py-10 max-w-full overflow-x-hidden" data-testid="overview-page">
      <div className="eyebrow flex items-center gap-2">
        <Briefcase size={12} /> EXECUTIVE OVERVIEW
      </div>
      <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
        Good to see you, <span className="text-[color:var(--brand-3)]">{user?.name?.split(" ")[0]}</span>.
      </h1>
      <p className="text-[color:var(--ink-3)] text-sm mt-2">
        Portfolio at a glance — {kpis.site_count} sites · {kpis.total_capacity_MW.toFixed(2)} MW under intelligence.
      </p>

      {/* Headline KPIs */}
      <div className="grid md:grid-cols-4 gap-4 mt-8">
        <div className="gs-card p-6" data-testid="exec-kpi-production">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            PRODUCTION TODAY <TrendingUp size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-3 text-[color:var(--ink)]">
            {(kpis.actual_kWh_day / 1000).toFixed(1)} <span className="text-lg text-[color:var(--ink-3)]">MWh</span>
          </div>
          <div className="text-[11px] text-[color:var(--brand-3)] mt-1">
            {(kpis.actual_kWh_day / kpis.expected_kWh_day * 100).toFixed(1)}% of expected
          </div>
        </div>
        <div className="gs-card p-6" data-testid="exec-kpi-availability">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            AVAILABILITY <Sparkles size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-3 text-[color:var(--ink)]">
            {kpis.avg_availability_pct.toFixed(1)}<span className="text-lg text-[color:var(--ink-3)]">%</span>
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">
            PR {kpis.avg_performance_ratio_pct.toFixed(1)}%
          </div>
        </div>
        <div className="gs-card p-6" data-testid="exec-kpi-loss">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            REVENUE AT RISK <DollarSign size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-3 text-[color:var(--ink)]">
            ${kpis.total_revenue_loss_usd.toFixed(0)}
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">
            {kpis.total_lost_kWh.toFixed(0)} kWh lost today
          </div>
        </div>
        <div className="gs-card p-6" data-testid="exec-kpi-co2">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            CO₂ AVOIDED / YR <Leaf size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-3 text-[color:var(--ink)]">
            {co2AvoidedTonnes.toFixed(0)} <span className="text-lg text-[color:var(--ink-3)]">t</span>
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">
            ≈ {(co2AvoidedTonnes * 3.4).toFixed(0)} homes/yr
          </div>
        </div>
      </div>

      {/* Portfolio by category */}
      <div className="grid lg:grid-cols-2 gap-6 mt-8">
        <div className="gs-card p-6" data-testid="exec-portfolio-mix">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] text-[color:var(--ink-3)]">PORTFOLIO MIX</div>
              <div className="text-sm text-[color:var(--ink)] mt-1">By asset category</div>
            </div>
            <Link to="/dashboard" className="text-[11px] font-mono text-[color:var(--brand-3)] hover:underline inline-flex items-center gap-1">
              Explore <ArrowRight size={11} />
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {categories.filter((c) => c.site_count > 0).map((c) => {
              const pct = Math.round((c.total_capacity_kW / kpis.total_capacity_kW) * 100);
              return (
                <div key={c.category} data-testid={`exec-mix-${c.priority}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[color:var(--ink-2)]">{c.category}</span>
                    <span className="font-mono text-[color:var(--ink-3)]">
                      {c.site_count} sites · {(c.total_capacity_kW / 1000).toFixed(1)} MW · {pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[color:var(--bg-3)] overflow-hidden">
                    <div className="h-full bg-[color:var(--brand)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Critical risks */}
        <div className="gs-card p-6" data-testid="exec-risks">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] text-[color:var(--ink-3)]">TOP RISKS · CRITICAL</div>
              <div className="text-sm text-[color:var(--ink)] mt-1">{topAlarms.length} active critical alarms</div>
            </div>
            <Link to="/alerts" className="text-[11px] font-mono text-[color:var(--brand-3)] hover:underline inline-flex items-center gap-1">
              Alert Center <ArrowRight size={11} />
            </Link>
          </div>
          {topAlarms.length === 0 ? (
            <div className="text-[color:var(--ink-3)] text-sm mt-4">No critical alarms 🎉</div>
          ) : (
            <div className="mt-4 space-y-2">
              {topAlarms.map((a) => (
                <div key={a.alarm_id} className="border border-[color:var(--line-2)] rounded-xl p-3 flex items-start gap-3" data-testid={`exec-risk-${a.alarm_id}`}>
                  <div className="p-1.5 rounded-lg bg-[#fecaca] text-[#7f1d1d]">
                    <AlertTriangle size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[color:var(--ink)]">{a.root_cause_category}</div>
                    <div className="text-[10px] font-mono text-[color:var(--ink-3)]">
                      {a.site_id} · {a.duration_hours}h · {new Date(a.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <Link to={`/site/${a.site_id}`} className="text-[10px] font-mono text-[color:var(--brand-3)] hover:underline">
                    OPEN
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        <Link to="/reports" className="gs-card p-5 hover:border-[color:var(--brand)] transition" data-testid="exec-cta-reports">
          <div className="font-mono text-[10px] text-[color:var(--ink-3)]">REPORTS</div>
          <div className="font-display text-xl text-[color:var(--ink)] mt-2">Weekly digest & PDFs →</div>
        </Link>
        <Link to="/dashboard" className="gs-card p-5 hover:border-[color:var(--brand)] transition" data-testid="exec-cta-dashboard">
          <div className="font-mono text-[10px] text-[color:var(--ink-3)]">LIVE DASHBOARD</div>
          <div className="font-display text-xl text-[color:var(--ink)] mt-2">Drill into every site →</div>
        </Link>
        <Link to="/alerts" className="gs-card p-5 hover:border-[color:var(--brand)] transition" data-testid="exec-cta-alerts">
          <div className="font-mono text-[10px] text-[color:var(--ink-3)]">ALERT CENTER</div>
          <div className="font-display text-xl text-[color:var(--ink)] mt-2">See what needs decisions →</div>
        </Link>
      </div>
    </div>
  );
}
