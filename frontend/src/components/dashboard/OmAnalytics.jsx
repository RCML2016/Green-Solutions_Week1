import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Activity, AlertTriangle, Battery, Database, Sun } from "lucide-react";

const number = (value, digits = 0) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "—";

function Metric({ label, value, note, icon: Icon }) {
  return (
    <div className="gs-card p-5">
      <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[color:var(--ink-3)]">
        {label}<Icon size={15} />
      </div>
      <div className="font-display text-2xl mt-3 text-[color:var(--ink)]">{value}</div>
      <div className="text-xs text-[color:var(--ink-3)] mt-1">{note}</div>
    </div>
  );
}

/** Existing fleet endpoints supply a dated, seeded demonstration snapshot. */
export default function OmAnalytics({ kpis, category }) {
  const [sites, setSites] = useState([]);
  const [alarms, setAlarms] = useState([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    Promise.all([
      api.get("/fleet/sites", { params: { ...(category && { category }), limit: 500 } }),
      api.get("/fleet/alarms", { params: { ...(category && { category }), limit: 500 } }),
    ]).then(([siteResponse, alarmResponse]) => {
      if (!active) return;
      setSites(siteResponse.data.items || []);
      setAlarms(alarmResponse.data.items || []);
    }).catch(() => {
      if (active) { setError(true); setSites([]); setAlarms([]); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category]);

  const ranked = useMemo(() => sites
    .filter((site) => site.latest_revenue_loss_usd != null || site.high_sev_alarms > 0)
    .sort((a, b) =>
      (b.latest_revenue_loss_usd || 0) - (a.latest_revenue_loss_usd || 0) ||
      (b.high_sev_alarms || 0) - (a.high_sev_alarms || 0)
    ).slice(0, 5), [sites]);
  const openCritical = alarms.filter((alarm) =>
    alarm.status !== "Resolved" && ["High", "Critical"].includes(alarm.severity)
  ).slice(0, 5);
  const solarScope = !category || /solar/i.test(category);
  const bessScope = !category || /battery|bess/i.test(category);
  const variance = kpis?.expected_kWh_day > 0
    ? ((kpis.actual_kWh_day - kpis.expected_kWh_day) / kpis.expected_kWh_day) * 100
    : null;

  return (
    <section className="space-y-5" aria-label="Operations and maintenance analytics" data-testid="om-analytics">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="eyebrow">OPERATIONS ANALYTICS</div>
          <h2 className="font-display text-2xl text-[color:var(--ink)] mt-2">Performance to action</h2>
        </div>
        <span className="text-xs rounded-full px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200">
          Seeded demonstration data · historical snapshot
        </span>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric label="Sites in scope" value={number(kpis?.site_count)} note="Selected fleet category" icon={Activity} />
        <Metric label="Availability" value={kpis?.site_count ? `${number(kpis.avg_availability_pct, 1)}%` : "—"}
          note="Dataset average; contract exclusions unconfigured" icon={Sun} />
        <Metric label="Production variance" value={variance == null ? "—" : `${variance > 0 ? "+" : ""}${number(variance, 1)}%`}
          note="Actual versus dataset expected kWh" icon={Activity} />
        <Metric label="Estimated loss" value={kpis ? `$${number(kpis.total_revenue_loss_usd)}` : "—"}
          note="Dataset estimate; tariff basis not verified" icon={AlertTriangle} />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="gs-card p-6">
          <h3 className="font-display text-lg text-[color:var(--ink)]">Production and work</h3>
          <div className="mt-4 space-y-3 text-sm text-[color:var(--ink-2)]">
            <div className="flex justify-between gap-3"><span>Actual / expected</span><strong className="font-mono">{number(kpis?.actual_kWh_day)} / {number(kpis?.expected_kWh_day)} kWh</strong></div>
            <div className="flex justify-between gap-3"><span>Estimated energy lost</span><strong className="font-mono">{number(kpis?.total_lost_kWh)} kWh</strong></div>
            <div className="flex justify-between gap-3"><span>Open work orders</span><strong className="font-mono">{number(kpis?.work_orders_open)}</strong></div>
            <div className="flex justify-between gap-3"><span>Open alarms</span><strong className="font-mono">{number(kpis?.alarms_open)}</strong></div>
          </div>
          <p className="text-xs text-[color:var(--ink-3)] mt-4">These values come from the seeded fleet performance snapshot. They do not represent a live daily total.</p>
        </div>
        <div className="gs-card p-6">
          <h3 className="font-display text-lg text-[color:var(--ink)]">Technology readiness</h3>
          <div className="mt-4 space-y-3 text-sm text-[color:var(--ink-2)]">
            {solarScope && <div className="flex gap-3"><Sun size={17} className="shrink-0 text-[color:var(--brand-3)]" /><span>Solar: production, expected energy, performance ratio and availability are available in the seeded dataset.</span></div>}
            {bessScope && <div className="flex gap-3"><Battery size={17} className="shrink-0 text-[color:var(--brand-3)]" /><span>BESS: SOC, SOH, usable capacity, cycles and round-trip efficiency need validated BMS/EMS feeds. No values are inferred here.</span></div>}
            <div className="flex gap-3"><Database size={17} className="shrink-0 text-[color:var(--brand-3)]" /><span>Telemetry freshness and connector health need source timestamps before a site can be marked data healthy.</span></div>
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="gs-card p-6">
          <h3 className="font-display text-lg text-[color:var(--ink)]">Sites to investigate</h3>
          <p className="text-xs text-[color:var(--ink-3)] mt-1">Ranked by dataset loss estimate, then high severity alarms.</p>
          {loading && <p className="text-sm mt-4">Loading sites…</p>}
          {error && <p role="alert" className="text-sm mt-4">Site data unavailable. Rankings cannot be shown.</p>}
          {!loading && !error && !ranked.length && <p className="text-sm mt-4">No ranked sites in this category.</p>}
          <div className="mt-3 divide-y divide-[color:var(--line-2)]">
            {ranked.map((site) => (
              <Link key={site.site_id} to={`/site/${encodeURIComponent(site.site_id)}`}
                className="py-3 flex justify-between gap-3 hover:text-[color:var(--brand-3)]">
                <span className="min-w-0"><strong className="block text-sm truncate">{site.site_name}</strong><small className="text-[color:var(--ink-3)]">{site.state} · {site.high_sev_alarms || 0} high alarms</small></span>
                <span className="font-mono text-sm shrink-0">${number(site.latest_revenue_loss_usd)}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="gs-card p-6">
          <h3 className="font-display text-lg text-[color:var(--ink)]">Open high severity alarms</h3>
          <p className="text-xs text-[color:var(--ink-3)] mt-1">Alarm records; diagnostic confidence has not been calculated.</p>
          {loading && <p className="text-sm mt-4">Loading alarms…</p>}
          {error && <p role="alert" className="text-sm mt-4">Alarm data unavailable.</p>}
          {!loading && !error && !openCritical.length && <p className="text-sm mt-4">No open high severity alarms in the loaded records.</p>}
          <div className="mt-3 divide-y divide-[color:var(--line-2)]">
            {openCritical.map((alarm) => (
              <div key={alarm.alarm_id} className="py-3 flex gap-3 items-start">
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0"><div className="text-sm text-[color:var(--ink)]">{alarm.root_cause_category || "Unclassified alarm"}</div>
                  <div className="text-xs text-[color:var(--ink-3)]">{alarm.site_id} · {alarm.severity} · {alarm.status}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
