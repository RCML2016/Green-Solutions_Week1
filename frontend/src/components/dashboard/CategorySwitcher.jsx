import { Sun, Building2, Users, Battery, Wind, Home, Droplets, Zap } from "lucide-react";

const ICONS = {
  "Utility-Scale Solar": Sun,
  "Commercial Rooftop Solar": Building2,
  "Community Solar": Users,
  "Battery Energy Storage": Battery,
  "Wind Farm": Wind,
  "Residential / C&I Distributed Solar": Home,
  "Small Hydro": Droplets,
  "Small Distributed Wind": Zap,
};

/** Category switcher — chip row for filtering the fleet by asset category */
export default function CategorySwitcher({ categories, active, onChange }) {
  return (
    <div className="gs-card p-4" data-testid="category-switcher">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] text-[color:var(--ink-3)]">FLEET CATEGORIES</div>
        <div className="text-[10px] font-mono text-[color:var(--brand-3)]">
          {categories.reduce((n, c) => n + c.site_count, 0)} SITES · {categories.reduce((n, c) => n + c.asset_count, 0).toLocaleString()} ASSETS
        </div>
      </div>
      <div className="flex flex-wrap gap-2 min-w-0">
        <button
          onClick={() => onChange("")}
          data-testid="category-all"
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            !active
              ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]"
              : "border-[color:var(--line)] text-[color:var(--ink-2)] hover:border-[color:var(--brand)]"
          }`}
        >
          All Fleet
          <span className="text-[10px] font-mono opacity-75">{categories.reduce((n, c) => n + c.site_count, 0)}</span>
        </button>
        {categories.filter((c) => c.site_count > 0).map((c) => {
          const Icon = ICONS[c.category] || Sun;
          const on = active === c.category;
          return (
            <button
              key={c.category}
              onClick={() => onChange(c.category)}
              data-testid={`category-${c.priority}`}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                on
                  ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]"
                  : "border-[color:var(--line)] text-[color:var(--ink-2)] hover:border-[color:var(--brand)]"
              }`}
            >
              <Icon size={12} />
              <span>{c.category}</span>
              <span className="text-[10px] font-mono opacity-75">{c.site_count}</span>
              {c.tier === "core" && <span className="text-[9px] font-mono text-[color:var(--brand-3)]">P{c.priority}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
