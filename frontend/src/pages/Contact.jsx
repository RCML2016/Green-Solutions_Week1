import { useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/contact", form);
      toast.success("Thanks — we'll be in touch soon.");
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#eef1ec] text-[#062015] py-16 px-6 lg:px-14 min-h-[80vh]">
      <div className="max-w-[900px] mx-auto grid lg:grid-cols-2 gap-14">
        <div>
          <div className="eyebrow">CONTACT</div>
          <h1 className="font-display text-4xl md:text-5xl mt-4 leading-[1.05]">
            Let's make your <br /> assets <span className="text-[#0a7a48]">smarter.</span>
          </h1>
          <p className="text-[#062015]/70 max-w-md mt-6">
            Tell us about your portfolio and operational challenges — we'll show you what Green
            Solutions can do with your data.
          </p>
          <div className="mt-8 flex items-center gap-3 text-sm">
            <Mail size={16} className="text-[#0a7a48]" />
            <a href="mailto:hello@greensolutions.ai" className="hover:text-[#0a7a48]">
              hello@greensolutions.ai
            </a>
          </div>
        </div>

        <form onSubmit={submit} className="gs-card-light p-8 space-y-4" data-testid="contact-form">
          <div>
            <label className="text-xs font-mono text-[#062015]/60">NAME</label>
            <input
              required
              data-testid="contact-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full bg-white border border-[#062015]/12 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22d17a]"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-[#062015]/60">EMAIL</label>
            <input
              required
              type="email"
              data-testid="contact-email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full bg-white border border-[#062015]/12 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22d17a]"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-[#062015]/60">MESSAGE</label>
            <textarea
              required
              rows={5}
              data-testid="contact-message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="mt-1 w-full bg-white border border-[#062015]/12 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22d17a]"
            />
          </div>
          <button
            disabled={busy}
            data-testid="contact-submit"
            className="gs-btn-primary w-full justify-center disabled:opacity-60"
          >
            {busy ? "Sending..." : (<>Send Message <Send size={14} /></>)}
          </button>
        </form>
      </div>
    </div>
  );
}
