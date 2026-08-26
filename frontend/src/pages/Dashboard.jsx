import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Activity, Sparkles, Zap, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/portfolio/metrics");
        setData(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sevColor = {
    high: "text-red-300 bg-red-500/10 border-red-500/20",
    medium: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    low: "text-[#6dfcb2] bg-[#22d17a]/10 border-[#22d17a]/20",
  };

  return (
    <div className="px-6 lg:px-14 py-10 min-h-[80vh]" data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <div className="eyebrow flex items-center gap-2"><span className="pulse-dot" /> LIVE INTELLIGENCE</div>
          <h1 className="font-display text-3xl md:text-4xl mt-3">
            Welcome, <span className="text-[#22d17a]">{user?.name?.split(" ")[0] || "Operator"}</span>.
          </h1>
          <p className="text-white/55 text-sm mt-2">
            Portfolio intelligence and AI findings — refreshed continuously.
          </p>
        </div>
        <div className="font-mono text-[10px] text-white/40 flex items-center gap-4">
          <span>SESSION · {user?.email}</span>
        </div>
      </div>

      {loading ? (
        <div className="text-white/50 text-sm">Loading intelligence...</div>
      ) : data ? (
        <>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { l: "PORTFOLIO HEALTH", v: `${data.portfolio_health}%`, d: `↑ ${data.portfolio_health_change}%`, i: Activity },
              { l: "AI FINDINGS", v: String(data.ai_findings).padStart(2, "0"), d: `${data.high_priority_findings} high priority`, i: Sparkles },
              { l: "AI CONFIDENCE", v: `${data.ai_confidence}%`, d: "Portfolio avg.", i: Sparkles },
              { l: "ENERGY 24H", v: `${data.energy_last_24h_mwh} MWh`, d: `${data.assets_online}/${data.assets_total} online`, i: Zap },
            ].map((k) => (
              <div key={k.l} className="rounded-2xl bg-[#0a2e1e] border border-white/5 p-5" data-testid={`kpi-${k.l.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center justify-between text-[10px] font-mono text-white/50">
                  <span>{k.l}</span>
                  <k.i size={14} className="text-[#6dfcb2]" />
                </div>
                <div className="font-display text-3xl mt-3">{k.v}</div>
                <div className="text-[11px] text-[#6dfcb2] mt-1">{k.d}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mt-8">
            <div className="lg:col-span-2 rounded-2xl bg-[#0a2e1e] border border-white/5 p-6">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] text-white/50">ENERGY PERFORMANCE · LAST 24H</div>
                <span className="text-[11px] font-mono text-[#6dfcb2] border border-[#22d17a]/40 rounded-full px-3 py-1">AI MONITORING</span>
              </div>
              <svg viewBox="0 0 600 180" className="w-full h-56 mt-4">
                <defs>
                  <linearGradient id="dashg" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22d17a" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#22d17a" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[40, 80, 120, 160].map((y) => (
                  <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="rgba(255,255,255,0.05)" />
                ))}
                <path d="M0,140 C50,130 90,110 140,95 C190,80 230,90 280,70 C330,50 380,60 430,45 C480,30 530,35 600,20 L600,180 L0,180 Z" fill="url(#dashg)" />
                <path d="M0,140 C50,130 90,110 140,95 C190,80 230,90 280,70 C330,50 380,60 430,45 C480,30 530,35 600,20" fill="none" stroke="#22d17a" strokeWidth="2" />
              </svg>
            </div>

            <div className="rounded-2xl bg-[#0a2e1e] border border-white/5 p-6">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] text-white/50">AI PRIORITY FINDINGS</div>
                <AlertTriangle size={14} className="text-amber-300" />
              </div>
              <div className="mt-3 divide-y divide-white/5">
                {data.findings.map((f) => (
                  <div key={f.code} className="py-3 flex items-center gap-3">
                    <span className="font-mono text-[10px] text-[#6dfcb2]">{f.code}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/90 truncate">{f.title}</div>
                      <div className={`inline-block mt-1 text-[10px] font-mono border rounded-full px-2 py-0.5 ${sevColor[f.severity]}`}>
                        {f.severity.toUpperCase()}
                      </div>
                    </div>
                    <span className="font-mono text-xs text-white/70">{f.confidence}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-white/50 text-sm">Unable to load metrics.</div>
      )}
    </div>
  );
}
