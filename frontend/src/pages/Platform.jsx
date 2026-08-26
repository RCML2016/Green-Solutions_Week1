import { Check, Cpu, Activity, Workflow, BarChart3, Sparkles } from "lucide-react";

export default function Platform() {
  return (
    <div className="bg-[#062015] text-white py-16 px-6 lg:px-14">
      <div className="max-w-[1100px] mx-auto">
        <div className="eyebrow">PLATFORM · AI OPERATING SYSTEM</div>
        <h1 className="font-display text-4xl md:text-6xl mt-4 leading-[1.05]">
          One platform. <br /> Every renewable signal, <span className="text-[#22d17a]">explained.</span>
        </h1>
        <p className="text-white/65 max-w-2xl mt-6">
          The Green Solutions platform ingests operational data across your renewable
          portfolio and applies explainable AI to surface what matters, when it matters.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mt-16">
          {[
            { i: Activity, t: "Portfolio Intelligence", d: "Unified 360° visibility across sites, assets and inverters — refreshed continuously." },
            { i: Sparkles, t: "Explainable AI Findings", d: "Every AI signal ships with supporting evidence, confidence score, and recommended action." },
            { i: Workflow, t: "Operations Workflows", d: "From AI finding to work-order — routed to the right person, with the right context." },
            { i: BarChart3, t: "Audience Reporting", d: "Owner, technician and compliance-grade reports generated from one intelligence pipeline." },
            { i: Cpu, t: "Human-in-the-Loop", d: "Configurable thresholds route lower-confidence findings for human validation." },
            { i: Check, t: "Enterprise-Grade Audit", d: "Every finding, action and report is traceable and audit-friendly out of the box." },
          ].map((f) => (
            <div key={f.t} className="gs-card-dark p-8">
              <div className="w-11 h-11 rounded-xl bg-[#22d17a]/15 text-[#6dfcb2] flex items-center justify-center">
                <f.i size={18} />
              </div>
              <h3 className="font-display text-2xl mt-6">{f.t}</h3>
              <p className="text-sm text-white/65 mt-3">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
