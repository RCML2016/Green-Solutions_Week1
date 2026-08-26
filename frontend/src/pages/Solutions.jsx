import { Activity, Sparkles, Workflow, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

const items = [
  { n: "01", t: "Asset Intelligence", d: "Understand the health and behavior of every renewable asset across your portfolio, from strings to inverters to entire sites.", i: Activity },
  { n: "02", t: "AI Diagnostics", d: "Detect anomalies, identify probable causes and surface confidence-backed findings with supporting evidence.", i: Sparkles },
  { n: "03", t: "Intelligent Operations", d: "Turn AI findings into prioritized work orders and route them to field and operations teams automatically.", i: Workflow },
  { n: "04", t: "AI Reporting", d: "Generate owner-level, technician-level and compliance-grade reports from a single intelligence pipeline.", i: BarChart3 },
];

export default function Solutions() {
  return (
    <div className="bg-[#eef1ec] text-[#062015] py-16 px-6 lg:px-14 min-h-[80vh]">
      <div className="max-w-[1100px] mx-auto">
        <div className="eyebrow">SOLUTIONS</div>
        <h1 className="font-display text-4xl md:text-6xl mt-4 leading-[1.05]">
          Four outcomes. <br /> One connected intelligence layer.
        </h1>
        <div className="grid md:grid-cols-2 gap-6 mt-14">
          {items.map((s) => (
            <div key={s.n} className="gs-card-light p-8">
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-xl bg-[#22d17a]/15 text-[#0a7a48] flex items-center justify-center">
                  <s.i size={18} />
                </div>
                <span className="font-mono text-[10px] text-[#062015]/40">{s.n}</span>
              </div>
              <h3 className="font-display text-2xl mt-8">{s.t}</h3>
              <p className="text-sm mt-3 text-[#062015]/70">{s.d}</p>
              <Link to="/dashboard" className="mt-6 inline-flex text-sm text-[#0a7a48] hover:text-[#22d17a]">See it live →</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
