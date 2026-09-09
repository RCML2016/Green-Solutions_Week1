import { Mail } from "lucide-react";

export default function TrademarkNotice() {
  return (
    <div className="gs-canvas py-16 px-6 lg:px-14 min-h-[80vh]" data-testid="trademark-notice-page">
      <div className="max-w-[760px] mx-auto">
        <div className="eyebrow">LEGAL</div>
        <h1 className="font-display text-4xl md:text-5xl mt-4 leading-[1.05] text-[color:var(--ink)]">
          Trademark Notice
        </h1>

        <div className="gs-card p-8 mt-10 space-y-6 text-[15px] leading-relaxed text-[color:var(--ink-2)]">
          <p>
            AssetNova™ and AssetNova Energy™ are trademarks claimed by their respective owner.
            All other trademarks, service marks, product names, company names, logos, and brands
            appearing on this website belong to their respective owners. Their use does not imply
            endorsement, sponsorship, or affiliation unless expressly stated.
          </p>
          <p>
            No part of this website—including its branding, software, design, text, graphics,
            workflows, dashboards, or other content—may be copied, reproduced, distributed, or used
            without prior written permission, except as permitted by applicable law.
          </p>
          <p>
            For trademark or intellectual-property inquiries, contact:
          </p>
          <div className="flex items-center gap-3">
            <Mail size={16} className="text-[color:var(--brand-3)]" />
            <a
              href="mailto:info@assetnovaenergy.com"
              data-testid="trademark-contact-email"
              className="text-[color:var(--ink)] hover:text-[color:var(--brand-3)] font-medium"
            >
              info@assetnovaenergy.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
