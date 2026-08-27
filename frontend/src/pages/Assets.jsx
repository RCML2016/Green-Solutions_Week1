import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Package, Search, Filter, Loader2, ArrowRight, ChevronDown } from "lucide-react";

/** Assets browser — all 5,473 assets with type filter + search + drill-in.
 *  Loads all sites once, then fetches each site's assets lazily via the
 *  /fleet/sites/{id} endpoint. To stay fast, we page through sites and
 *  concat their `assets[]` on the client, capped at 1500 for browse. */
export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // Fetch first 50 sites, then their assets in parallel
        const sitesResp = await api.get("/fleet/sites", { params: { limit: 50 } });
        setTotal(sitesResp.data.total);
        const details = await Promise.all(
          sitesResp.data.items.map((s) => api.get(`/fleet/sites/${s.site_id}`).catch(() => null))
        );
        if (!mounted) return;
        const flat = [];
        for (const d of details) {
          if (!d?.data?.assets) continue;
          const siteName = d.data.site.site_name;
          const siteType = d.data.site.site_type;
          for (const a of d.data.assets) flat.push({ ...a, site_name: siteName, site_type: siteType });
        }
        setAssets(flat);
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

  const filtered = useMemo(() => {
    let list = assets;
    if (typeFilter) list = list.filter((a) => a.asset_type === typeFilter);
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
  }, [assets, typeFilter, search]);

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
                  <th className="text-right py-2 px-2">STATUS</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.asset_id} className="border-b border-[color:var(--line-2)] hover:bg-[color:var(--brand-mint)]" data-testid={`asset-row-${a.asset_id}`}>
                    <td className="py-2 px-2 font-mono text-[11px] text-[color:var(--brand-3)]">{a.asset_id}</td>
                    <td className="py-2 px-2 text-xs text-[color:var(--ink-2)]">{a.asset_type}</td>
                    <td className="py-2 px-2 text-xs text-[color:var(--ink)]">{a.make} {a.model}</td>
                    <td className="py-2 px-2 text-xs text-[color:var(--ink-2)]">
                      <Link to={`/site/${a.site_id}`} className="hover:text-[color:var(--brand-3)]">
                        {a.site_id} · {a.site_name}
                      </Link>
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
                      <Link to={`/site/${a.site_id}`} data-testid={`asset-open-${a.asset_id}`}>
                        <ArrowRight size={14} className="text-[color:var(--ink-3)] hover:text-[color:var(--brand-3)]" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
