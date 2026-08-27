import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, ArrowUpRight, Check, Activity, Workflow, BarChart3, Cpu, Lightbulb } from "lucide-react";
import { useEffect, useRef } from "react";

function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && el.classList.add("in"),
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="reveal" style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export default function Landing() {
  return (
    <div>
      {/* HERO — bright, shiny */}
      <section className="relative overflow-hidden pt-12 lg:pt-20 pb-24"
        style={{
          background:
            "radial-gradient(1200px 600px at 15% -20%, rgba(52,211,153,0.28), transparent 60%)," +
            "radial-gradient(900px 500px at 100% 0%, rgba(253,224,71,0.18), transparent 60%)," +
            "linear-gradient(180deg, #ecfef4 0%, #f6f9f2 100%)",
        }}
      >
        <div className="absolute inset-0 gs-grain opacity-50 pointer-events-none" />
        <div className="relative max-w-[1200px] mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="eyebrow flex items-center gap-2">
              <span className="pulse-dot" /> AI-POWERED SUSTAINABILITY INTELLIGENCE
            </div>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl leading-[1.02] mt-6 text-[color:var(--ink)]">
              Make every <br />renewable asset <br />
              <span style={{ backgroundImage: "linear-gradient(120deg,#0f9d58 0%,#16a34a 40%,#65e6b1 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                more intelligent.
              </span>
            </h1>
            <p className="mt-8 text-[color:var(--ink-2)] max-w-lg text-[15px] leading-relaxed">
              AssetNova transforms renewable energy data into actionable
              intelligence — helping asset owners identify risk, understand
              performance and make faster operational decisions.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/platform" className="gs-btn-primary" data-testid="hero-explore-platform">
                Explore Platform <ArrowRight size={16} />
              </Link>
              <Link to="/how-it-works" className="gs-btn-ghost" data-testid="hero-how-it-works">
                See How It Works
              </Link>
            </div>
            <div className="mt-14 grid grid-cols-3 gap-6 max-w-lg border-t border-[color:var(--line)] pt-8">
              {[
                { k: "AI", v: "Asset Intelligence" },
                { k: "360°", v: "Portfolio Visibility" },
                { k: "24/7", v: "Intelligent Monitoring" },
              ].map((s) => (
                <div key={s.k}>
                  <div className="font-display text-2xl text-[color:var(--ink)]">{s.k}</div>
                  <div className="text-[11px] font-mono text-[color:var(--ink-3)] mt-1">{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard mock — light glass */}
          <Reveal delay={150}>
            <div className="relative">
              <div className="gs-glass p-5">
                <div className="flex items-center justify-between text-[10px] font-mono text-[color:var(--ink-3)]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[color:var(--line)]" />
                    <span className="w-2 h-2 rounded-full bg-[color:var(--line)]" />
                    <span className="w-2 h-2 rounded-full bg-[color:var(--line)]" />
                    <span className="ml-3">ASSETNOVA.COM</span>
                  </div>
                  <span className="flex items-center gap-1.5"><span className="pulse-dot" /> LIVE</span>
                </div>
                <div className="mt-5">
                  <div className="text-[10px] font-mono text-[color:var(--ink-3)]">PORTFOLIO INTELLIGENCE</div>
                  <div className="flex items-center justify-between mt-1">
                    <h3 className="font-display text-2xl text-[color:var(--ink)]">Renewable Portfolio</h3>
                    <span className="text-[10px] font-mono text-[color:var(--brand-3)] border border-[color:var(--brand)] bg-[color:var(--brand-tint)] rounded-full px-2 py-1">AI MONITORING</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-5">
                  {[
                    { l: "PORTFOLIO HEALTH", v: "80%", d: "↑ 4.2%" },
                    { l: "AI FINDINGS", v: "04", d: "02 high priority" },
                    { l: "AI CONFIDENCE", v: "84%", d: "Portfolio avg." },
                  ].map((c) => (
                    <div key={c.l} className="rounded-xl bg-white/70 border border-[color:var(--line-2)] p-4">
                      <div className="text-[9px] font-mono text-[color:var(--ink-3)]">{c.l}</div>
                      <div className="font-display text-2xl text-[color:var(--ink)] mt-2">{c.v}</div>
                      <div className="text-[10px] text-[color:var(--brand-3)] mt-1">{c.d}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl bg-white/70 border border-[color:var(--line-2)] p-4">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[color:var(--ink-3)]">
                    <span>ENERGY PERFORMANCE</span>
                    <span>LAST 24 HOURS</span>
                  </div>
                  <svg viewBox="0 0 300 80" className="w-full h-24 mt-3">
                    <defs>
                      <linearGradient id="lg1" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,60 C40,55 60,40 100,42 C140,44 160,25 200,20 C240,15 270,18 300,10 L300,80 L0,80 Z" fill="url(#lg1)" />
                    <path d="M0,60 C40,55 60,40 100,42 C140,44 160,25 200,20 C240,15 270,18 300,10" fill="none" stroke="#10b981" strokeWidth="1.8" />
                  </svg>
                </div>

                <div className="mt-4">
                  <div className="text-[10px] font-mono text-[color:var(--ink-3)] mb-2">AI PRIORITY FINDINGS</div>
                  {[
                    { c: "INV-04", t: "Communication Dropout", v: "91%" },
                    { c: "INV-01", t: "String Underperformance", v: "83%" },
                  ].map((f) => (
                    <div key={f.c} className="flex items-center justify-between py-2 border-t border-[color:var(--line-2)] first:border-t-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-[color:var(--brand-3)]">{f.c}</span>
                        <span className="text-sm text-[color:var(--ink)]">{f.t}</span>
                      </div>
                      <span className="font-mono text-[11px] text-[color:var(--ink-2)]">{f.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -top-4 -right-4 rounded-full bg-white border border-[color:var(--brand)] px-3 py-2 flex items-center gap-2 text-[11px] shadow-lg">
                <Sparkles size={12} className="text-[color:var(--brand-3)]" />
                <div>
                  <div className="text-[color:var(--ink)]">AI Insight</div>
                  <div className="text-[color:var(--ink-3)] text-[10px]">4 actionable findings</div>
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 rounded-full bg-white border border-[color:var(--brand)] px-3 py-2 flex items-center gap-2 text-[11px] shadow-lg">
                <Check size={12} className="text-[color:var(--brand-3)]" />
                <div>
                  <div className="text-[color:var(--ink)]">Action Ready</div>
                  <div className="text-[color:var(--ink-3)] text-[10px]">Operations prioritized</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FROM DATA TO DECISION */}
      <section className="py-24 px-6 lg:px-10 bg-white">
        <div className="max-w-[1200px] mx-auto grid lg:grid-cols-2 gap-16">
          <Reveal>
            <div>
              <div className="eyebrow">FROM DATA TO DECISION</div>
              <h2 className="font-display text-4xl md:text-5xl leading-tight mt-4 text-[color:var(--ink)]">
                The intelligence layer <br /> for renewable energy.
              </h2>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="text-[15px] leading-relaxed text-[color:var(--ink-2)]">
              Renewable energy portfolios generate enormous amounts of operational data.
              The challenge isn't collecting it. <strong className="text-[color:var(--ink)]">It's knowing what matters.</strong>
              <p className="mt-4 text-[color:var(--ink-3)]">
                AssetNova applies AI reasoning to transform raw asset data into
                understandable findings, prioritized actions and decision-ready reports.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SEE / UNDERSTAND / ACT */}
      <section className="py-16 px-6 lg:px-10 gs-canvas">
        <div className="max-w-[1200px] mx-auto">
          <Reveal>
            <div className="text-center">
              <div className="eyebrow inline-block">SEE · UNDERSTAND · ACT</div>
              <h2 className="font-display text-4xl md:text-5xl mt-4 text-[color:var(--ink)]">
                Intelligence that moves <br /> with your operation.
              </h2>
              <p className="text-[color:var(--ink-3)] max-w-xl mx-auto mt-4">
                One connected intelligence workflow from asset data to operational action.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6 mt-14">
            {[
              { n: "01", t: "See", i: Activity, d: "Gain a unified view of portfolio health, asset performance and emerging anomalies.", list: ["Portfolio visibility", "Asset-level intelligence", "Continuous monitoring"] },
              { n: "02", t: "Understand", i: Sparkles, d: "AI identifies abnormal patterns and explains the evidence behind each finding.", list: ["AI diagnostics", "Explainable findings", "Confidence scoring"], accent: true },
              { n: "03", t: "Act", i: ArrowRight, d: "Convert intelligence into prioritized operational actions and business reports.", list: ["Work-order recommendations", "Operations prioritization", "AI-generated reporting"] },
            ].map((c, idx) => (
              <Reveal key={c.n} delay={idx * 120}>
                <div className={`relative p-8 ${c.accent ? "gs-card-accent" : "gs-card"}`}>
                  <div className="absolute top-6 right-6 font-mono text-[10px] text-[color:var(--ink-3)]">{c.n}</div>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-white border border-[color:var(--line)] text-[color:var(--brand-3)]">
                    <c.i size={20} />
                  </div>
                  <h3 className="font-display text-2xl mt-8 text-[color:var(--ink)]">{c.t}</h3>
                  <p className="mt-3 text-sm text-[color:var(--ink-2)]">{c.d}</p>
                  <ul className="mt-6 space-y-2 text-sm">
                    {c.list.map((li) => (
                      <li key={li} className="flex items-center gap-2">
                        <Check size={14} className="text-[color:var(--brand-3)]" />
                        <span className="text-[color:var(--ink-2)]">{li}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTIONS */}
      <section className="py-24 px-6 lg:px-10 bg-white">
        <div className="max-w-[1200px] mx-auto">
          <Reveal>
            <div className="eyebrow">SOLUTIONS</div>
            <h2 className="font-display text-4xl md:text-5xl mt-3 text-[color:var(--ink)]">
              One intelligence platform. <br /> Multiple operational outcomes.
            </h2>
            <p className="text-[color:var(--ink-3)] max-w-xl mt-4">
              Designed to connect the people, data and decisions that keep renewable assets performing.
            </p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6 mt-12">
            {[
              { n: "01", t: "Asset Intelligence", d: "Understand the health and behavior of every asset across your renewable portfolio.", i: Activity, cta: "Explore Asset 360" },
              { n: "02", t: "AI Diagnostics", d: "Detect anomalies, identify probable causes and surface confidence-backed findings.", i: Sparkles, cta: "Explore AI Intelligence" },
              { n: "03", t: "Intelligent Operations", d: "Turn AI findings into prioritized actions for field and operations teams.", i: Workflow, cta: "Explore Operations" },
              { n: "04", t: "AI Reporting", d: "Generate owner, technician and compliance reports from a single intelligence pipeline.", i: BarChart3, cta: "Explore Reporting" },
              { n: "05", t: "AI Recommended Actions", d: "Every finding ships with a next-best-action operators can accept in one click.", i: Lightbulb, cta: "Explore Actions", accent: true },
            ].map((c, i) => (
              <Reveal key={c.n} delay={i * 100}>
                <div className={`p-8 h-full ${c.accent ? "gs-card-accent md:col-span-2" : "gs-card"}`}>
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl bg-[color:var(--brand-tint)] text-[color:var(--brand-3)] flex items-center justify-center">
                      <c.i size={18} />
                    </div>
                    <span className="font-mono text-[10px] text-[color:var(--ink-3)]">{c.n}</span>
                  </div>
                  <h3 className="font-display text-2xl mt-8 text-[color:var(--ink)]">{c.t}</h3>
                  <p className="text-sm mt-3 text-[color:var(--ink-2)]">{c.d}</p>
                  <Link to="/solutions" className="mt-6 inline-flex items-center gap-1 text-sm text-[color:var(--brand-3)] hover:text-[color:var(--brand)] transition">
                    {c.cta} <ArrowRight size={14} />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Platform CTA — one accent dark block for visual contrast */}
      <section className="py-24 px-6 lg:px-10 gs-canvas">
        <div className="max-w-[1200px] mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <Reveal>
            <div>
              <div className="eyebrow">THE ASSETNOVA PLATFORM</div>
              <h2 className="font-display text-4xl md:text-5xl mt-4 text-[color:var(--ink)]">
                From portfolio <br /> visibility to <br />
                <span style={{ backgroundImage: "linear-gradient(120deg,#0f9d58 0%,#16a34a 40%,#65e6b1 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                  intelligent action.
                </span>
              </h2>
              <p className="text-[color:var(--ink-2)] max-w-md mt-6">
                A unified operating experience for renewable asset intelligence —
                designed to help teams move from reactive monitoring to proactive
                decision-making.
              </p>
              <ul className="mt-8 space-y-3">
                {[
                  "AI-powered portfolio monitoring",
                  "Explainable asset diagnostics",
                  "Human-in-the-loop decision controls",
                  "Audience-specific AI reporting",
                ].map((li) => (
                  <li key={li} className="flex items-center gap-3">
                    <Check size={14} className="text-[color:var(--brand-3)]" />
                    <span className="text-[color:var(--ink-2)] text-sm">{li}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10">
                <Link to="/dashboard" className="gs-btn-primary" data-testid="platform-launch">
                  Launch AI Platform <ArrowUpRight size={16} />
                </Link>
              </div>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="gs-glass p-6">
              <div className="flex items-center justify-between text-[10px] font-mono text-[color:var(--ink-3)]">
                <span>INTELLIGENCE FLOW</span>
                <span className="flex items-center gap-1.5"><span className="pulse-dot" /> ACTIVE</span>
              </div>
              <div className="mt-6 space-y-3">
                {[
                  { i: Activity, l: "Asset Data", s: "Performance signals" },
                  { i: Sparkles, l: "AI Reasoning", s: "Detect · Explain" },
                  { i: Check, l: "Action", s: "Prioritize · Report" },
                ].map((s, idx) => (
                  <div key={s.l} className="flex items-center gap-4 rounded-xl bg-white border border-[color:var(--line-2)] p-4">
                    <div className="w-9 h-9 rounded-lg bg-[color:var(--brand-tint)] text-[color:var(--brand-3)] flex items-center justify-center">
                      <s.i size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[color:var(--ink)]">{s.l}</div>
                      <div className="text-[11px] font-mono text-[color:var(--ink-3)]">{s.s}</div>
                    </div>
                    <span className="ml-auto font-mono text-[10px] text-[color:var(--ink-3)]">0{idx + 1}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-6">
                {[
                  { l: "AI CONFIDENCE", v: "84%" },
                  { l: "FINDINGS", v: "04" },
                  { l: "ACTIONS", v: "03" },
                ].map((k) => (
                  <div key={k.l} className="rounded-xl border border-[color:var(--line)] bg-white p-3">
                    <div className="text-[9px] font-mono text-[color:var(--ink-3)]">{k.l}</div>
                    <div className="font-display text-lg mt-1 text-[color:var(--ink)]">{k.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 lg:px-10 bg-white">
        <div className="max-w-[900px] mx-auto text-center">
          <Reveal>
            <div className="eyebrow">START THE JOURNEY</div>
            <h2 className="font-display text-4xl md:text-5xl mt-4 text-[color:var(--ink)]">
              Ready to make your <br />
              renewable assets <span className="text-[color:var(--brand-3)]">smarter?</span>
            </h2>
            <p className="text-[color:var(--ink-3)] max-w-lg mx-auto mt-6">
              Explore the AssetNova AI platform and see how operational
              intelligence can turn renewable energy data into action.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link to="/dashboard" className="gs-btn-primary" data-testid="cta-launch">
                Launch AI Platform <ArrowUpRight size={16} />
              </Link>
              <Link to="/contact" className="gs-btn-ghost" data-testid="cta-contact">
                Contact Us
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
