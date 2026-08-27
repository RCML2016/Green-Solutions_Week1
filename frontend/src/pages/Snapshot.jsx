import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { API } from "@/lib/api";
import { Activity, Sparkles, Zap, AlertTriangle, Lock } from "lucide-react";
import { BrandWordmark } from "@/components/BrandMark";

export default function Snapshot() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/public/snapshots/${token}`);
        if (!res.ok) throw new Error("Snapshot not found or expired");
        setData(await res.json());
      } catch (e) { setError(e.message); }
    })();
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center gs-canvas px-6">
        <div className="gs-card p-10 text-center max-w-md">
          <Lock size={28} className="mx-auto text-[color:var(--ink-3)]" />
          <h1 className="font-display text-2xl mt-4 text-[color:var(--ink)]">Snapshot unavailable</h1>
          <p className="text-sm text-[color:var(--ink-3)] mt-2">{error}</p>
          <Link to="/" className="mt-6 inline-block gs-btn-primary text-sm" style={{ padding: "8px 16px" }}>
            Explore AssetNova
          </Link>
        </div>
      </div>
    );
  }
  if (!data) return <div className="min-h-screen flex items-center justify-center gs-canvas"><div className="pulse-dot" /></div>;

  const m = data.metrics;
  const sevColor = {
    high: { color: "#b91c1c", background: "#fee2e2", border: "#fecaca" },
    medium: { color: "#b45309", background: "#fef3c7", border: "#fde68a" },
    low: { color: "#065f46", background: "#d1fae5", border: "#a7f3d0" },
  };

  return (
    <div className="min-h-screen gs-canvas" data-testid="snapshot-page">
      <header className="border-b border-[color:var(--line)] bg-[color:var(--bg-2)]/70 backdrop-blur-md px-6 lg:px-14 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <BrandWordmark size={22} />
        </Link>
        <div className="text-[10px] font-mono text-[color:var(--ink-3)]">
          READ-ONLY SNAPSHOT · CAPTURED {new Date(data.created_at).toLocaleString()}
        </div>
      </header>

      <div className="px-6 lg:px-14 py-10 max-w-[1200px] mx-auto">
        <div className="eyebrow">SHARED SNAPSHOT</div>
        <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
          Portfolio intelligence <span className="text-[color:var(--brand-3)]">at a moment in time.</span>
        </h1>
        <p className="text-[color:var(--ink-3)] text-sm mt-2">
          This is a public read-only view — the live dashboard requires an account.
        </p>

        <div className="grid md:grid-cols-4 gap-4 mt-8">
          {[
            { l: "PORTFOLIO HEALTH", v: `${m.portfolio_health}%`, d: `↑ ${m.portfolio_health_change}%`, i: Activity },
            { l: "AI FINDINGS", v: String(m.ai_findings).padStart(2, "0"), d: `${m.high_priority_findings} high priority`, i: Sparkles },
            { l: "AI CONFIDENCE", v: `${m.ai_confidence}%`, d: "Portfolio avg.", i: Sparkles },
            { l: "ENERGY 24H", v: `${m.energy_last_24h_mwh} MWh`, d: `${m.assets_online}/${m.assets_total} online`, i: Zap },
          ].map((k) => (
            <div key={k.l} className="gs-card p-5">
              <div className="flex items-center justify-between text-[10px] font-mono text-[color:var(--ink-3)]">
                <span>{k.l}</span>
                <k.i size={14} className="text-[color:var(--brand-3)]" />
              </div>
              <div className="font-display text-3xl mt-3 text-[color:var(--ink)]">{k.v}</div>
              <div className="text-[11px] text-[color:var(--brand-3)] mt-1">{k.d}</div>
            </div>
          ))}
        </div>

        <div className="gs-card p-6 mt-6">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] text-[color:var(--ink-3)]">AI PRIORITY FINDINGS</div>
            <AlertTriangle size={14} className="text-[color:var(--amber)]" />
          </div>
          <div className="mt-3 divide-y divide-[color:var(--line-2)]">
            {m.findings.map((f) => (
              <div key={f.code} className="py-3 flex items-center gap-3">
                <span className="font-mono text-[10px] text-[color:var(--brand-3)]">{f.code}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[color:var(--ink)] truncate">{f.title}</div>
                  <span className="inline-block mt-1 text-[10px] font-mono border rounded-full px-2 py-0.5"
                    style={sevColor[f.severity]}>{f.severity.toUpperCase()}</span>
                </div>
                <span className="font-mono text-xs text-[color:var(--ink-2)]">{f.confidence}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link to="/register" className="gs-btn-primary">Get live intelligence →</Link>
        </div>
      </div>
    </div>
  );
}
