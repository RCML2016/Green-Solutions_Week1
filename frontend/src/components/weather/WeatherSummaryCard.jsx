import { Droplets, Wind, CloudRain, Cloud, Sunrise, Sunset, AlertTriangle, Radio, Clock, WifiOff } from "lucide-react";

const IMPACT_STYLES = {
  "Normal": "bg-emerald-50 text-emerald-900 border-emerald-200",
  "Moderate Impact": "bg-amber-50 text-amber-900 border-amber-200",
  "High Impact": "bg-orange-50 text-orange-900 border-orange-200",
  "Severe Weather Risk": "bg-red-50 text-red-900 border-red-200",
};

const STATUS_META = {
  live: { label: "LIVE", icon: Radio, cls: "text-emerald-700" },
  cached: { label: "CACHED", icon: Clock, cls: "text-[color:var(--ink-3)]" },
  stale: { label: "STALE", icon: Clock, cls: "text-amber-700" },
  unavailable: { label: "UNAVAILABLE", icon: WifiOff, cls: "text-[color:var(--ink-3)]" },
};

function icon(url, size = 40) {
  if (!url) return null;
  const src = url.startsWith("http") ? url : `https:${url}`;
  return <img src={src} alt="" width={size} height={size} data-testid="weather-icon" />;
}

export default function WeatherSummaryCard({ data, locationLabel, inheritedFromSite, compact = false }) {
  if (!data) return null;
  const status = STATUS_META[data.data_status] || STATUS_META.unavailable;

  return (
    <div className="gs-card p-5" data-testid="weather-summary-card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="eyebrow">WEATHER</div>
          <div className="text-sm text-[color:var(--ink)] mt-1" data-testid="weather-location-label">{locationLabel}</div>
          {typeof inheritedFromSite === "boolean" && (
            <div className="text-[10px] font-mono text-[color:var(--ink-3)] mt-0.5" data-testid="weather-inheritance-note">
              {inheritedFromSite ? "Inherited from site location" : "Uses this asset's own location"}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono ${status.cls}`} data-testid="weather-data-status">
            <status.icon size={11} /> {status.label}
          </span>
          <span className="text-[10px] font-mono text-[color:var(--ink-3)]">
            {data.provider || "—"}{data.last_updated ? ` · ${new Date(data.last_updated).toLocaleTimeString()}` : ""}
          </span>
        </div>
      </div>

      {!data.available ? (
        <div className="mt-4 text-sm text-[color:var(--ink-3)]" data-testid="weather-unavailable">
          Weather unavailable — {data.reason || "no data on file for this location."}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {icon(data.current?.icon)}
              <div>
                <div className="text-3xl font-display text-[color:var(--ink)]" data-testid="weather-current-temp">
                  {Math.round(data.current?.temp_c)}°C
                </div>
                <div className="text-xs text-[color:var(--ink-2)]">{data.current?.condition}</div>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border ${IMPACT_STYLES[data.impact_level] || IMPACT_STYLES.Normal}`}
              data-testid="weather-impact-badge"
            >
              {(data.impact_level === "Severe Weather Risk" || data.impact_level === "High Impact") && <AlertTriangle size={11} />}
              {data.impact_level}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
            <Stat icon={Droplets} label="Humidity" value={`${data.current?.humidity ?? "—"}%`} />
            <Stat icon={Wind} label="Wind" value={`${data.current?.wind_kph ?? "—"} kph ${data.current?.wind_dir ?? ""}`} />
            <Stat icon={CloudRain} label="Rain chance" value={`${data.today?.daily_chance_of_rain ?? "—"}%`} />
            <Stat icon={Cloud} label="Cloud cover" value={`${data.current?.cloud ?? "—"}%`} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
            <Stat icon={Sunrise} label="Sunrise" value={data.today?.sunrise || "—"} />
            <Stat icon={Sunset} label="Sunset" value={data.today?.sunset || "—"} />
            <Stat label="Today High" value={data.today?.maxtemp_c != null ? `${Math.round(data.today.maxtemp_c)}°C` : "—"} />
            <Stat label="Today Low" value={data.today?.mintemp_c != null ? `${Math.round(data.today.mintemp_c)}°C` : "—"} />
          </div>

          {data.alerts?.length > 0 && (
            <div className="mt-4 space-y-2" data-testid="weather-alerts">
              {data.alerts.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs bg-red-50 border border-red-200 text-red-900 rounded-lg p-2.5">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">{a.event || a.headline}</div>
                    {a.severity && <div className="text-[10px] font-mono opacity-80">{a.severity}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!compact && data.forecast?.length > 0 && (
            <div className="mt-5" data-testid="weather-forecast-strip">
              <div className="text-[10px] font-mono text-[color:var(--ink-3)] mb-2">
                {data.forecast.length}-DAY FORECAST
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {data.forecast.map((d) => (
                  <div key={d.date} className="shrink-0 w-[76px] text-center rounded-xl border border-[color:var(--line)] p-2" data-testid={`forecast-day-${d.date}`}>
                    <div className="text-[10px] font-mono text-[color:var(--ink-3)]">
                      {new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}
                    </div>
                    <div className="flex justify-center">{icon(d.icon, 28)}</div>
                    <div className="text-[11px] text-[color:var(--ink)] mt-0.5">
                      {Math.round(d.maxtemp_c)}° / {Math.round(d.mintemp_c)}°
                    </div>
                    <div className="text-[9px] text-[color:var(--ink-3)]">{d.daily_chance_of_rain}% rain</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5 text-[color:var(--ink-2)]">
      {Icon && <Icon size={12} className="text-[color:var(--brand-3)] shrink-0" />}
      <div>
        <div className="text-[9px] font-mono text-[color:var(--ink-3)]">{label}</div>
        <div className="text-xs">{value}</div>
      </div>
    </div>
  );
}
