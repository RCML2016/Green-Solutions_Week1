import { useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Mail, MapPin, Building2, Send } from "lucide-react";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post("/contact", form);
      toast.success("Thanks — we'll be in touch soon.");
      setForm({ name: "", email: "", message: "" });
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="gs-canvas py-16 px-6 lg:px-14 min-h-[80vh]" data-testid="contact-page">
      <div className="max-w-[900px] mx-auto grid lg:grid-cols-2 gap-14">
        <div>
          <div className="eyebrow">CONTACT</div>
          <h1 className="font-display text-4xl md:text-5xl mt-4 leading-[1.05] text-[color:var(--ink)]">
            Let's make your <br /> assets <span className="text-[color:var(--brand-3)]">smarter.</span>
          </h1>
          <p className="text-[color:var(--ink-2)] max-w-md mt-6" data-testid="contact-section-message">
            Interested in an AssetNova demo or pilot? Contact us to discuss your renewable-energy
            operations and asset-management needs.
          </p>
          <div className="mt-8 space-y-3 text-sm" data-testid="contact-info-block">
            <div className="flex items-center gap-3">
              <Building2 size={16} className="text-[color:var(--brand-3)]" />
              <span className="text-[color:var(--ink)]" data-testid="contact-company-name">AssetNova</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin size={16} className="text-[color:var(--brand-3)]" />
              <span className="text-[color:var(--ink)]" data-testid="contact-location">Dallas, Texas, USA</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-[color:var(--brand-3)]" />
              <a href="mailto:info@assetnova.com" data-testid="contact-email-link" className="text-[color:var(--ink)] hover:text-[color:var(--brand-3)]">
                info@assetnova.com
              </a>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="gs-card p-8 space-y-4" data-testid="contact-form">
          <div>
            <label className="text-xs font-mono text-[color:var(--ink-3)]">NAME</label>
            <input required data-testid="contact-name"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="gs-input mt-1" />
          </div>
          <div>
            <label className="text-xs font-mono text-[color:var(--ink-3)]">EMAIL</label>
            <input required type="email" data-testid="contact-email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="gs-input mt-1" />
          </div>
          <div>
            <label className="text-xs font-mono text-[color:var(--ink-3)]">MESSAGE</label>
            <textarea required rows={5} data-testid="contact-message"
              value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="gs-input mt-1" />
          </div>
          <button disabled={busy} data-testid="contact-submit" className="gs-btn-primary w-full justify-center disabled:opacity-60">
            {busy ? "Sending..." : (<>Send Message <Send size={14} /></>)}
          </button>
        </form>
      </div>
    </div>
  );
}
