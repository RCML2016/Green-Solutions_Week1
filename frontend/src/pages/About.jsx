export default function About() {
  return (
    <div className="bg-white py-16 px-6 lg:px-14 min-h-[80vh]">
      <div className="max-w-[1000px] mx-auto">
        <div className="eyebrow">OUR VISION</div>
        <h1 className="font-display text-4xl md:text-6xl mt-4 leading-[1.05] text-[color:var(--ink)]">
          A smarter energy future <br /> starts with better <span className="text-[color:var(--brand-3)]">intelligence.</span>
        </h1>
        <p className="text-[color:var(--ink-2)] max-w-2xl mt-6 text-[15px] leading-relaxed">
          We believe the next generation of renewable energy operations will not be
          driven by more dashboards. It will be driven by systems that understand
          what the data means — and help people act on it.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mt-14">
          {[
            { k: "DATA", v: "Every signal matters." },
            { k: "AI", v: "Every pattern can teach us." },
            { k: "ACTION", v: "Every insight should move the operation." },
          ].map((c) => (
            <div key={c.k} className="gs-card-accent p-8">
              <div className="font-display text-3xl text-[color:var(--brand-3)]">{c.k}</div>
              <p className="text-[color:var(--ink-2)] text-sm mt-4">{c.v}</p>
            </div>
          ))}
        </div>

        <div className="mt-20 grid md:grid-cols-4 gap-6">
          {[
            { n: "01", t: "Explainable AI", d: "Every finding includes supporting evidence and recommended action." },
            { n: "02", t: "Confidence Scoring", d: "Lower-confidence findings can be routed for human review." },
            { n: "03", t: "Human Oversight", d: "AI supports decisions while operational teams retain control." },
            { n: "04", t: "Audit-Friendly", d: "Findings and actions can be transformed into structured reports." },
          ].map((v) => (
            <div key={v.n} className="border-t border-[color:var(--brand)] pt-6">
              <div className="font-mono text-[10px] text-[color:var(--brand-3)]">{v.n}</div>
              <div className="font-display text-lg mt-3 text-[color:var(--ink)]">{v.t}</div>
              <p className="text-[color:var(--ink-2)] text-sm mt-2">{v.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
