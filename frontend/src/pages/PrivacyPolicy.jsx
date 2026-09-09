export default function PrivacyPolicy() {
  const sections = [
    {
      t: "Information We Collect",
      d: "We may collect account information (such as name, email, and role), usage data related to your interaction with the AssetNova™ platform, and information you voluntarily submit through forms such as our contact page.",
    },
    {
      t: "How We Use Information",
      d: "Information is used to operate and improve the AssetNova™ platform, provide customer support, communicate with you about your account, and maintain the security and integrity of our services.",
    },
    {
      t: "Data Sharing",
      d: "We do not sell your personal information. Data may be shared with service providers who help us operate the platform, or when required by law.",
    },
    {
      t: "Data Security",
      d: "We use reasonable administrative, technical, and physical safeguards designed to protect information processed through AssetNova™ against unauthorized access, alteration, or disclosure.",
    },
    {
      t: "Cookies",
      d: "The platform may use cookies or similar technologies to maintain sessions and improve your experience. You can control cookie settings through your browser.",
    },
    {
      t: "Your Rights",
      d: "Depending on your jurisdiction, you may have rights to access, correct, or request deletion of your personal information. Contact us to exercise these rights.",
    },
    {
      t: "Changes to This Policy",
      d: "We may update this Privacy Policy from time to time. Continued use of AssetNova™ after changes are posted constitutes acceptance of the updated policy.",
    },
  ];

  return (
    <div className="gs-canvas py-16 px-6 lg:px-14 min-h-[80vh]" data-testid="privacy-policy-page">
      <div className="max-w-[760px] mx-auto">
        <div className="eyebrow">LEGAL</div>
        <h1 className="font-display text-4xl md:text-5xl mt-4 leading-[1.05] text-[color:var(--ink)]">
          Privacy Policy
        </h1>
        <p className="text-[color:var(--ink-3)] mt-4 text-sm font-mono">
          Last updated: {new Date().getFullYear()}
        </p>

        <div className="gs-card p-8 mt-10 space-y-8">
          {sections.map((s) => (
            <div key={s.t}>
              <h2 className="font-display text-lg text-[color:var(--ink)]">{s.t}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--ink-2)]">{s.d}</p>
            </div>
          ))}
          <div data-testid="privacy-contact-section">
            <h2 className="font-display text-lg text-[color:var(--ink)]">Contact</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--ink-2)]">
              Questions about this Privacy Policy can be directed to:
            </p>
            <div className="mt-3 text-[15px] text-[color:var(--ink-2)] leading-relaxed">
              <div>AssetNova</div>
              <div>Dallas, Texas, USA</div>
              <a href="mailto:info@assetnova.com" data-testid="privacy-contact-email" className="text-[color:var(--ink)] hover:text-[color:var(--brand-3)] font-medium">
                info@assetnova.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
