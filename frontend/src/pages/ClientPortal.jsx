import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Eye, Sun, TrendingUp, Zap, ShieldCheck, Loader2, ArrowRight, Inbox,
} from "lucide-react";

/**
 * Client Portal — read-only tile view of the sites approved by the portfolio owner.
 * If the user has no approved scope, we show an "onboarding" state.
 */
export default function ClientPortal() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.get("/client/portfolio")
      .then(({ data }) => mounted && setData(data))
      .catch(() => mounted && setData(null))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="px-6 lg:px-14 py-16 flex items-center gap-2 text-[color:var(--ink-3)]">
        <Loader2 className="animate-spin" size={14} /> Loading approved portfolio…
      </div>
    );
  }

  if (!data || data.scope_empty) {
    return (
      <div className="px-6 lg:px-14 py-16" data-testid="client-portal-page">
        <div className="gs-card p-10 text-center max-w-2xl mx-auto" data-testid="client-portal-empty">
          <div className="w-14 h-14 rounded-2xl bg-[color:var(--brand-tint)] text-[color:var(--brand-3)] flex items-center justify-center mx-auto">
            <Inbox size={26} />
          </div>
          <h1 className="font-display text-2xl mt-4 text-[color:var(--ink)]">
            Your portfolio is being set up
          </h1>
          <p className="text-[color:var(--ink-3)] text-sm mt-3">
            Welcome, {user?.name?.split(" ")[0]}. Your portfolio owner hasn't approved
            any sites yet. Once they do, you'll see live production, availability, and
            reports here — nothing else. No dashboards, no team data. Just yours.
          </p>
          <div className="mt-6 text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-center gap-2">
            <ShieldCheck size={12} className="text-[color:var(--brand-3)]" />
            READ-ONLY · SCOPED TO YOUR APPROVED SITES
          </div>
        </div>
      </div>
    );
  }

  const { kpis, sites } = data;
  const yieldPct = kpis.expected_kWh_day > 0 ? (kpis.actual_kWh_day / kpis.expected_kWh_day * 100) : 0;

  return (
    <div className="px-6 lg:px-14 py-10 max-w-full overflow-x-hidden" data-testid="client-portal-page">
      <div className="eyebrow flex items-center gap-2">
        <Eye size={12} /> CLIENT PORTAL
      </div>
      <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
        Welcome, <span className="text-[color:var(--brand-3)]">{user?.name?.split(" ")[0]}</span>.
      </h1>
      <p className="text-[color:var(--ink-3)] text-sm mt-2">
        Read-only view · {sites.length} approved sites · {kpis.total_capacity_MW.toFixed(2)} MW.
      </p>

      {/* Client KPIs */}
      <div className="grid md:grid-cols-4 gap-4 mt-8">
        <div className="gs-card p-6" data-testid="client-kpi-sites">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            YOUR SITES <Sun size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-3 text-[color:var(--ink)]">{kpis.site_count}</div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">{kpis.total_capacity_MW.toFixed(2)} MW</div>
        </div>
        <div className="gs-card p-6" data-testid="client-kpi-yield">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            ENERGY YIELD <TrendingUp size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-3 text-[color:var(--ink)]">
            {yieldPct.toFixed(1)}<span className="text-lg text-[color:var(--ink-3)]">%</span>
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">
            {(kpis.actual_kWh_day / 1000).toFixed(1)} / {(kpis.expected_kWh_day / 1000).toFixed(1)} MWh
          </div>
        </div>
        <div className="gs-card p-6" data-testid="client-kpi-avail">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            AVAILABILITY <ShieldCheck size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-3 text-[color:var(--ink)]">
            {kpis.avg_availability_pct.toFixed(1)}<span className="text-lg text-[color:var(--ink-3)]">%</span>
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">
            PR {kpis.avg_performance_ratio_pct.toFixed(1)}%
          </div>
        </div>
        <div className="gs-card p-6" data-testid="client-kpi-production">
          <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center justify-between">
            PRODUCTION TODAY <Zap size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-3 text-[color:var(--ink)]">
            {(kpis.actual_kWh_day / 1000).toFixed(1)}<span className="text-lg text-[color:var(--ink-3)]"> MWh</span>
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">Approved sites only</div>
        </div>
      </div>

      {/* Site tiles */}
      <div className="mt-8">
        <div className="font-mono text-[10px] text-[color:var(--ink-3)] mb-3">
          YOUR SITES · SORTED BY PR%
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites
            .slice()
            .sort((a, b) => (b.performance_ratio_pct ?? 0) - (a.performance_ratio_pct ?? 0))
            .map((s) => (
              <Link
                key={s.site_id}
                to={`/site/${s.site_id}`}
                className="gs-card p-5 hover:border-[color:var(--brand)] transition"
                data-testid={`client-site-${s.site_id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[color:var(--brand-3)]">{s.site_id}</span>
                  <ArrowRight size={12} className="text-[color:var(--ink-3)]" />
                </div>
                <div className="text-sm text-[color:var(--ink)] mt-2 truncate">{s.site_name}</div>
                <div className="text-[10px] font-mono text-[color:var(--ink-3)] mt-1">
                  {s.state} · {s.site_capacity_kW?.toFixed(1)} kW
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[9px] font-mono text-[color:var(--ink-3)]">PR%</div>
                    <div className="font-display text-lg text-[color:var(--ink)]">
                      {s.performance_ratio_pct != null
                        ? `${Math.min(100, s.performance_ratio_pct).toFixed(1)}${s.performance_ratio_pct > 100 ? "*" : ""}`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-mono text-[color:var(--ink-3)]">AVAIL%</div>
                    <div className="font-display text-lg text-[color:var(--ink)]">
                      {s.availability_pct?.toFixed(1) ?? "—"}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
        </div>
      </div>

      <div className="mt-8 text-[10px] font-mono text-[color:var(--ink-3)] flex items-center gap-2 flex-wrap">
        <ShieldCheck size={12} className="text-[color:var(--brand-3)]" />
        READ-ONLY VIEW · SCOPE CONTROLLED BY PORTFOLIO OWNER
        <span className="w-full block mt-1 text-[color:var(--ink-3)]">
          * PR% shown at 100 when raw value exceeds 100 (data quality under review)
        </span>
      </div>
    </div>
  );
}
