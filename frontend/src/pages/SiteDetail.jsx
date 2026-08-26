import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import {
  ArrowLeft, MapPin, Zap, Sun, Wind, Battery, AlertTriangle,
  Wrench, Cpu, Thermometer, Loader2, Activity,
} from "lucide-react";

/** Site drill-down: assets, telemetry, weather, alarms, work orders. */
export default function SiteDetail() {
  const { site_id } = useParams();
  const [detail, setDetail] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get(`/fleet/sites/${site_id}`)
      .then(({ data }) => mounted && setDetail(data))
      .catch(() => mounted && setDetail(null))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [site_id]);

  // Poll telemetry every 5s (simulated live window)
  useEffect(() => {
    let mounted = true;
    const load = () =>
      api.get(`/fleet/telemetry`, { params: { site_id, hours: 24 } })
        .then(({ data }) => mounted && setTelemetry(data))
        .catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => { mounted = false; clearInterval(t); };
  }, [site_id]);

  if (loading) {
    return (
      <div className="px-6 lg:px-14 py-16 flex items-center gap-2 text-[color:var(--ink-3)]" data-testid="site-loading">
        <Loader2 className="animate-spin" size={14} /> Loading site {site_id}…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="px-6 lg:px-14 py-16" data-testid="site-not-found">
        <div className="gs-card p-8 text-center">
          <div className="font-display text-2xl text-[color:var(--ink)] mb-2">Site not found</div>
          <div className="text-[color:var(--ink-3)] text-sm mb-4">We couldn't find <code>{site_id}</code>.</div>
          <Link to="/dashboard" className="gs-btn-primary text-sm inline-flex">
            <ArrowLeft size={14} /> Back to fleet
          </Link>
        </div>
      </div>
    );
  }

  const { site, assets, asset_breakdown, latest_performance, latest_weather, recent_alarms, work_orders } = detail;
  const catIcons = { "Solar PV": Sun, "Wind": Wind, "BESS": Battery };
  const Icon = catIcons[site.energy_type] || Sun;

  return (
    <div className="px-6 lg:px-14 py-10 min-h-[80vh] space-y-6" data-testid="site-detail-page">
      {/* Header */}
      <div>
        <Link to="/dashboard" className="text-xs font-mono text-[color:var(--ink-3)] hover:text-[color:var(--brand-3)] inline-flex items-center gap-1 mb-4" data-testid="site-back">
          <ArrowLeft size={12} /> BACK TO FLEET
        </Link>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-[color:var(--brand-tint)] text-[color:var(--brand-3)] flex items-center justify-center">
            <Icon size={26} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono text-[color:var(--brand-3)]">{site.site_id} · {site.site_type}</div>
            <h1 className="font-display text-3xl text-[color:var(--ink)] mt-1">{site.site_name}</h1>
            <div className="text-[color:var(--ink-3)] text-sm mt-1 flex items-center gap-4 flex-wrap">
              <span className="inline-flex items-center gap-1"><MapPin size={12} /> {site.state}</span>
              <span>{site.energy_type}</span>
              <span>Capacity: <strong className="text-[color:var(--ink)] font-mono">{site.site_capacity_kW?.toFixed(1)} kW</strong></span>
              <span>Utility: {site.utility}</span>
              <span>Voltage: {site.voltage_level}</span>
              <span>COD: {site.commissioning_date?.slice(0, 10)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance & weather cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="gs-card p-5" data-testid="site-kpi-pr">
          <div className="font-mono text-[10px] text-[color:var(--ink-3)] flex items-center justify-between">
            PERF RATIO <Activity size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">
            {latest_performance?.performance_ratio_pct?.toFixed(1) ?? "—"}%
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">
            {latest_performance?.actual_kWh?.toFixed(0) ?? "—"} / {latest_performance?.expected_kWh?.toFixed(0) ?? "—"} kWh
          </div>
        </div>
        <div className="gs-card p-5" data-testid="site-kpi-avail">
          <div className="font-mono text-[10px] text-[color:var(--ink-3)] flex items-center justify-between">
            AVAILABILITY <Zap size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">
            {latest_performance?.availability_pct?.toFixed(1) ?? "—"}%
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">
            Degradation {latest_performance?.degradation_pct?.toFixed(1) ?? "—"}%
          </div>
        </div>
        <div className="gs-card p-5" data-testid="site-kpi-loss">
          <div className="font-mono text-[10px] text-[color:var(--ink-3)] flex items-center justify-between">
            REVENUE LOSS <AlertTriangle size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">
            ${latest_performance?.estimated_revenue_loss_usd?.toFixed(2) ?? "—"}
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">
            {latest_performance?.lost_kWh?.toFixed(1) ?? "—"} kWh lost today
          </div>
        </div>
        <div className="gs-card p-5" data-testid="site-kpi-weather">
          <div className="font-mono text-[10px] text-[color:var(--ink-3)] flex items-center justify-between">
            WEATHER <Thermometer size={12} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">
            {latest_weather?.module_temp_C?.toFixed(0) ?? "—"}°C
          </div>
          <div className="text-[11px] text-[color:var(--ink-3)] mt-1">
            Wind {latest_weather?.wind_speed_mps?.toFixed(1) ?? "—"} m/s · Soil {latest_weather?.soiling_index?.toFixed(2) ?? "—"}
          </div>
        </div>
      </div>

      {/* Telemetry chart (from sliding window) */}
      <div className="gs-card p-6" data-testid="site-telemetry">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-mono text-[10px] text-[color:var(--ink-3)]">
              TELEMETRY · LAST {telemetry?.window_hours ?? 24}H · {telemetry?.live ? "LIVE" : "SNAPSHOT"}
            </div>
            <div className="text-sm text-[color:var(--ink)] mt-1">
              Power kW vs Expected kW
            </div>
          </div>
          <span className="pulse-dot" />
        </div>
        {telemetry?.rows?.length ? (
          <TelemetryChart rows={telemetry.rows} />
        ) : (
          <div className="text-[color:var(--ink-3)] text-sm py-8 text-center">No telemetry available.</div>
        )}
      </div>

      {/* Assets + Alarms + WOs */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Assets breakdown */}
        <div className="gs-card p-6" data-testid="site-assets">
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono text-[10px] text-[color:var(--ink-3)]">ASSET BREAKDOWN · {assets.length}</div>
            <Cpu size={14} className="text-[color:var(--brand-3)]" />
          </div>
          <div className="space-y-2 mb-4">
            {asset_breakdown.map((b) => (
              <div key={b.type} className="flex items-center justify-between text-xs" data-testid={`asset-type-${b.type}`}>
                <span className="text-[color:var(--ink-2)]">{b.type}</span>
                <span className="font-mono text-[color:var(--brand-3)]">{b.count}</span>
              </div>
            ))}
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1 border-t border-[color:var(--line-2)] pt-3">
            {assets.slice(0, 30).map((a) => (
              <div key={a.asset_id} className="flex items-center gap-2 text-xs py-1" data-testid={`asset-${a.asset_id}`}>
                <span className="font-mono text-[10px] text-[color:var(--brand-3)] w-16">{a.asset_id}</span>
                <span className="text-[color:var(--ink-2)] flex-1 truncate">{a.asset_type} · {a.make} {a.model}</span>
                <span
                  className="font-mono text-[9px] px-1.5 py-0.5 rounded-full"
                  style={
                    a.status === "Active"
                      ? { color: "#087346", background: "#dff5e9" }
                      : { color: "#b45309", background: "#fef3c7" }
                  }
                >
                  {a.status?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Alarms */}
        <div className="gs-card p-6" data-testid="site-alarms">
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono text-[10px] text-[color:var(--ink-3)]">RECENT ALARMS · {recent_alarms.length}</div>
            <AlertTriangle size={14} className="text-[color:var(--brand-3)]" />
          </div>
          {recent_alarms.length === 0 ? (
            <div className="text-[color:var(--ink-3)] text-sm">No alarms.</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recent_alarms.map((a) => (
                <div key={a.alarm_id} className="border border-[color:var(--line-2)] rounded-xl p-2.5" data-testid={`site-alarm-${a.alarm_id}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-[color:var(--brand-3)]">{a.alarm_id}</span>
                    <span
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                      style={
                        a.severity === "Critical" ? { color: "#7f1d1d", background: "#fecaca" }
                        : a.severity === "High" ? { color: "#b91c1c", background: "#fee2e2" }
                        : a.severity === "Medium" ? { color: "#b45309", background: "#fef3c7" }
                        : { color: "#087346", background: "#dff5e9" }
                      }
                    >
                      {a.severity.toUpperCase()}
                    </span>
                    <span className="text-[9px] font-mono text-[color:var(--ink-3)]">{a.status}</span>
                  </div>
                  <div className="text-xs text-[color:var(--ink)] mt-1">{a.root_cause_category}</div>
                  <div className="text-[10px] text-[color:var(--ink-3)] mt-0.5">
                    {a.asset_id} · {a.duration_hours}h · {new Date(a.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Work orders */}
        <div className="gs-card p-6" data-testid="site-work-orders">
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono text-[10px] text-[color:var(--ink-3)]">WORK ORDERS · {work_orders.length}</div>
            <Wrench size={14} className="text-[color:var(--brand-3)]" />
          </div>
          {work_orders.length === 0 ? (
            <div className="text-[color:var(--ink-3)] text-sm">No work orders.</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {work_orders.map((wo) => (
                <div key={wo.work_order_id} className="border border-[color:var(--line-2)] rounded-xl p-2.5" data-testid={`site-wo-${wo.work_order_id}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-[color:var(--brand-3)]">{wo.work_order_id}</span>
                    <span
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                      style={
                        wo.status === "Resolved" ? { color: "#087346", background: "#dff5e9" }
                        : wo.status === "Dispatched" ? { color: "#b45309", background: "#fef3c7" }
                        : { color: "#687870", background: "#edf2ef" }
                      }
                    >
                      {wo.status?.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-[color:var(--ink)] mt-1">{wo.resolution_action}</div>
                  <div className="text-[10px] text-[color:var(--ink-3)] mt-0.5">
                    {wo.trade} · {wo.labor_hours}h · ${wo.parts_cost_usd}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Simple SVG chart for actual vs expected power */
function TelemetryChart({ rows }) {
  const W = 700, H = 200, PAD = 30;
  const powers = rows.map((r) => r.power_kW ?? 0);
  const expected = rows.map((r) => r.expected_power_kW ?? 0);
  const maxY = Math.max(...powers, ...expected, 1) * 1.1;
  const step = (W - 2 * PAD) / Math.max(1, rows.length - 1);
  const pt = (arr) => arr.map((v, i) => `${PAD + i * step},${H - PAD - (v / maxY) * (H - 2 * PAD)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56">
      <defs>
        <linearGradient id="tele-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#18a866" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#18a866" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={PAD} x2={W - PAD} y1={PAD + (H - 2 * PAD) * f} y2={PAD + (H - 2 * PAD) * f} stroke="#edf2ef" />
      ))}
      {/* Expected line (dashed) */}
      <polyline fill="none" stroke="#687870" strokeWidth="1.4" strokeDasharray="4 3" points={pt(expected)} />
      {/* Actual line */}
      <polyline fill="none" stroke="#18a866" strokeWidth="2.2" points={pt(powers)} />
      <polygon fill="url(#tele-area)" points={`${PAD},${H - PAD} ${pt(powers)} ${W - PAD},${H - PAD}`} />
      {/* Legend */}
      <g fontFamily="JetBrains Mono, monospace" fontSize="9">
        <text x={PAD} y={H - 6} fill="#687870">Actual</text>
        <line x1={PAD + 40} y1={H - 9} x2={PAD + 60} y2={H - 9} stroke="#18a866" strokeWidth="2" />
        <text x={PAD + 68} y={H - 6} fill="#687870">Expected</text>
        <line x1={PAD + 118} y1={H - 9} x2={PAD + 138} y2={H - 9} stroke="#687870" strokeWidth="1.4" strokeDasharray="4 3" />
        <text x={W - PAD - 30} y={PAD - 4} fill="#687870" textAnchor="end">Peak {maxY.toFixed(0)} kW</text>
      </g>
    </svg>
  );
}
