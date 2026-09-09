const IMPACT_DOT = {
  "Normal": "bg-emerald-500",
  "Moderate Impact": "bg-amber-500",
  "High Impact": "bg-orange-500",
  "Severe Weather Risk": "bg-red-500",
};

/** Compact one-line weather chip for table rows — icon + temp + impact dot. */
export default function WeatherChip({ chip }) {
  if (!chip) return <span className="text-xs font-mono text-[color:var(--ink-3)]">—</span>;
  if (!chip.available) {
    return <span className="text-[10px] font-mono text-[color:var(--ink-3)]" data-testid="weather-chip-unavailable">N/A</span>;
  }
  const src = chip.icon ? (chip.icon.startsWith("http") ? chip.icon : `https:${chip.icon}`) : null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" data-testid="weather-chip">
      {src && <img src={src} alt="" width={18} height={18} />}
      <span className="font-mono text-[color:var(--ink)]">{chip.temp_c != null ? `${Math.round(chip.temp_c)}°C` : "—"}</span>
      <span className={`w-1.5 h-1.5 rounded-full ${IMPACT_DOT[chip.impact_level] || "bg-[color:var(--ink-3)]"}`} title={chip.impact_level} />
    </span>
  );
}
