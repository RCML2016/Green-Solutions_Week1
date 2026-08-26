import { Activity, Sparkles, ArrowRight, Check } from "lucide-react";

const steps = [
  { n: "01", t: "See", i: Activity, d: "Gain a unified view of portfolio health, asset performance and emerging anomalies." },
  { n: "02", t: "Understand", i: Sparkles, d: "AI identifies abnormal patterns and explains the evidence behind each finding." },
  { n: "03", t: "Act", i: ArrowRight, d: "Convert intelligence into prioritized operational actions and business reports.", accent: true },
];

export default function HowItWorks() {
  return (
    <div className="bg-[#eef1ec] text-[#062015] py-16 px-6 lg:px-14 min-h-[80vh]">
      <div className="max-w-[1100px] mx-auto">
        <div className="eyebrow">HOW IT WORKS</div>
        <h1 className="font-display text-4xl md:text-6xl mt-4 leading-[1.05]">
          From signal to action <br /> in three connected steps.
        </h1>

        <div className="mt-14 relative">
          <div className="absolute left-6 top-6 bottom-6 w-px bg-[#22d17a]/25 hidden md:block" />
          <div className="space-y-6">
            {steps.map((s) => (
              <div key={s.n} className="relative md:pl-16">
                <div className="absolute left-0 top-0 hidden md:flex w-12 h-12 rounded-xl bg-[#22d17a] text-[#062015] items-center justify-center">
                  <s.i size={20} />
                </div>
                <div className={`p-8 ${s.accent ? "gs-card-dark" : "gs-card-light"}`}>
                  <div className="font-mono text-[10px] opacity-60">STEP {s.n}</div>
                  <h3 className="font-display text-3xl mt-2">{s.t}</h3>
                  <p className={`mt-3 max-w-xl text-sm ${s.accent ? "text-white/75" : "text-[#062015]/70"}`}>{s.d}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {["Automated", "Explainable", "Auditable"].map((tag) => (
                      <span key={tag} className={`px-3 py-1 rounded-full text-[11px] font-mono ${s.accent ? "border border-white/20 text-white/75" : "border border-[#062015]/15 text-[#062015]/70"}`}>
                        <Check size={11} className="inline mr-1 -mt-0.5" /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
