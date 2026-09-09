import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Package, Search, Filter, Loader2, ArrowRight, X, MapPin } from "lucide-react";
import WeatherChip from "@/components/weather/WeatherChip";
import WeatherSummaryCard from "@/components/weather/WeatherSummaryCard";

const IMPACT_LEVELS = ["Normal", "Moderate Impact", "High Impact", "Severe Weather Risk"];

/** Assets browser backed by the paginated asset API (no N+1 site requests). */
export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [zipFilter, setZipFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [impactFilter, setImpactFilter] = useState("");
  const [weatherChips, setWeatherChips] = useState({});
  const [activeAsset, setActiveAsset] = useState(null);
  const [activeWeather, setActiveWeather] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const response = await api.get("/fleet-admin/assets", { params: { limit: 500 } });
        if (!mounted) return;
        setTotal(response.data.total);
        setAssets(response.data.items);
        const siteIds = [...new Set(response.data.items.map((a) => a.site_id))].slice(0, 20).join(",");
        if (siteIds) {
          api.get("/fleet/weather/batch", { params: { site_ids: siteIds } })
            .then(({ data }) => mounted && setWeatherChips(data))
            .catch(() => {});
        }
      } catch (e) {
        console.warn("Assets load failed:", e?.message);
      } finally {
        mounted && setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const types = useMemo(() => {
    const s = {};
    for (const a of assets) s[a.asset_type] = (s[a.asset_type] || 0) + 1;
    return Object.entries(s).sort((a, b) => b[1] - a[1]);
  }, [assets]);

  const states = useMemo(() => [...new Set(assets.map((a) => a.state).filter(Boolean))].sort(), [assets]);
  const cities = useMemo(() => [...new Set(assets.map((a) => a.city).filter(Boolean))].sort(), [assets]);
  const conditions = useMemo(() => {
    const set = new Set();
    Object.values(weatherChips).forEach((c) => c?.condition && set.add(c.condition));
    return [...set].sort();
  }, [weatherChips]);

  const filtered = useMemo(() => {
    let list = assets;
    if (typeFilter) list = list.filter((a) => a.asset_type === typeFilter);
    if (stateFilter) list = list.filter((a) => a.state === stateFilter);
    if (cityFilter) list = list.filter((a) => a.city === cityFilter);
    if (zipFilter.trim()) list = list.filter((a) => (a.zip_code || "").includes(zipFilter.trim()));
    if (conditionFilter) list = list.filter((a) => weatherChips[a.site_id]?.condition === conditionFilter);
    if (impactFilter) list = list.filter((a) => weatherChips[a.site_id]?.impact_level === impactFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.asset_id.toLowerCase().includes(q) ||
          (a.make || "").toLowerCase().includes(q) ||
          (a.model || "").toLowerCase().includes(q) ||
          (a.site_name || "").toLowerCase().includes(q)
      );
    }
    return list.slice(0, 500);
  }, [assets, typeFilter, stateFilter, cityFilter, zipFilter, conditionFilter, impactFilter, search, weatherChips]);

  const openAsset = (a) => {
    setActiveAsset(a);
    setActiveWeather(null);
    api.get(`/fleet/assets/${a.asset_id}/weather`)
      .then(({ data }) => setActiveWeather(data))
      .catch(() => setActiveWeather({ available: false, data_status: "unavailable", reason: "Request failed" }));
  };

  return (
    <div className="px-6 lg:px-14 py-10 max-w-full overflow-x-hidden" data-testid="assets-page">
      <div className="eyebrow flex items-center gap-2">
        <Package size={12} /> ASSETS
      </div>
      <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
        Fleet assets · <span className="text-[color:var(--brand-3)]">{assets.length.toLocaleString()}</span> loaded
      </h1>
      <p className="text-[color:var(--ink-3)] text-sm mt-2">
        Browse inverters, combiners, trackers, batteries and more across your fleet · showing top {filtered.length}.
      </p>

      {/* Filters */}
      <div className="mt-6 gs-card p-4" data-testid="assets-filters">
        <div className="flex items-center flex-wrap gap-2 mb-3">
          <span className="text-[10px] font-mono text-[color:var(--ink-3)] flex items-center gap-1">
            <Filter size={11} /> TYPE
          </span>
          <button
            onClick={() => setTypeFilter("")}
            data-testid="assets-type-all"
            className={`text-[11px] font-mono px-3 py-1.5 rounded-full border transition ${!typeFilter ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]" : "border-[color:var(--line)] text-[color:var(--ink-2)]"}`}
          >
            ALL · {assets.length}
          </button>
          {types.map(([t, count]) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              data-testid={`assets-type-${t}`}
              className={`text-[11px] font-mono px-3 py-1.5 rounded-full border transition ${typeFilter === t ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]" : "border-[color:var(--line)] text-[color:var(--ink-2)]"}`}
            >
              {t} · {count}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          <select data-testid="assets-filter-state" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="gs-input text-xs">
            <option value="">All States</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select data-testid="assets-filter-city" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="gs-input text-xs">
            <option value="">All Cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            data-testid="assets-filter-zip"
            value={zipFilter}
            onChange={(e) => setZipFilter(e.target.value)}
            placeholder="ZIP code"
            className="gs-input text-xs"
          />
          <select data-testid="assets-filter-condition" value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)} className="gs-input text-xs">
            <option value="">Any Condition</option>
            {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select data-testid="assets-filter-impact" value={impactFilter} onChange={(e) => setImpactFilter(e.target.value)} className="gs-input text-xs">
            <option value="">Any Weather Impact</option>
            {IMPACT_LEVELS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-3)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by asset id, make, model, or site name..."
            data-testid="assets-search"
            className="gs-input text-sm w-full"
            style={{ padding: "10px 12px 10px 32px" }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="gs-card p-6 mt-6" data-testid="assets-table">
        {loading ? (
          <div className="py-10 text-center text-[color:var(--ink-3)] text-sm flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={14} /> Loading assets...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-[color:var(--ink-3)] text-sm">No assets match.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-mono text-[color:var(--ink-3)] border-b border-[color:var(--line-2)]">
                  <th className="text-left py-2 px-2">ASSET</th>
                  <th className="text-left py-2 px-2">TYPE</th>
                  <th className="text-left py-2 px-2">MAKE / MODEL</th>
                  <th className="text-left py-2 px-2">SITE</th>
                  <th className="text-left py-2 px-2">WEATHER</th>
                  <th className="text-right py-2 px-2">STATUS</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.asset_id} className="border-b border-[color:var(--line-2)] hover:bg-[color:var(--brand-mint)] cursor-pointer" data-testid={`asset-row-${a.asset_id}`} onClick={() => openAsset(a)}>
                    <td className="py-2 px-2 font-mono text-[11px] text-[color:var(--brand-3)]">{a.asset_id}</td>
                    <td className="py-2 px-2 text-xs text-[color:var(--ink-2)]">{a.asset_type}</td>
                    <td className="py-2 px-2 text-xs text-[color:var(--ink)]">{a.make} {a.model}</td>
                    <td className="py-2 px-2 text-xs text-[color:var(--ink-2)]">
                      {a.site_id} · {a.site_name}
                    </td>
                    <td className="py-2 px-2">
                      <WeatherChip chip={weatherChips[a.site_id]} />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span
                        className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                        style={
                          a.status === "Active"
                            ? { color: "#087346", background: "#dff5e9" }
                            : { color: "#b45309", background: "#fef3c7" }
                        }
                      >
                        {a.status?.toUpperCase() || "—"}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button data-testid={`asset-open-${a.asset_id}`} onClick={(e) => { e.stopPropagation(); openAsset(a); }}>
                        <ArrowRight size={14} className="text-[color:var(--ink-3)] hover:text-[color:var(--brand-3)]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Asset detail modal */}
      {activeAsset && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" data-testid="asset-detail-modal" onClick={() => setActiveAsset(null)}>
          <div className="bg-[color:var(--bg)] rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] text-[color:var(--brand-3)]">{activeAsset.asset_id} · {activeAsset.asset_type}</div>
                <div className="font-display text-xl text-[color:var(--ink)] mt-1">{activeAsset.make} {activeAsset.model}</div>
                <Link to={`/site/${activeAsset.site_id}`} className="text-xs text-[color:var(--ink-3)] hover:text-[color:var(--brand-3)] inline-flex items-center gap-1 mt-1">
                  <MapPin size={11} /> {activeAsset.site_id} · {activeAsset.site_name}
                </Link>
              </div>
              <button data-testid="asset-detail-modal-close" onClick={() => setActiveAsset(null)}>
                <X size={18} className="text-[color:var(--ink-3)] hover:text-[color:var(--ink)]" />
              </button>
            </div>
            <WeatherSummaryCard
              data={activeWeather}
              locationLabel={activeWeather?.location_label || `${activeAsset.site_name} — ${activeAsset.city || ""}, ${activeAsset.state || ""} ${activeAsset.zip_code || ""}`}
              inheritedFromSite={activeWeather?.inherited_from_site}
              compact
            />
          </div>
        </div>
      )}
    </div>
  );
}
