import { useState, useEffect } from "react";
import { X, Loader2, PhoneCall, CheckCircle2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

const DEMO_SLOTS = ["Next 24h", "This week", "Next week", "Flexible"];
const DEMO_ROLES = ["Portfolio Owner", "Asset Manager", "O&M Lead", "Investor", "Other"];

/** Book-a-Demo modal — captures name/email/company/role/slot and drops a
 *  `contact_messages` record via the existing /api/contact endpoint. */
export default function BookDemoModal({ open, onClose }) {
  const [form, setForm] = useState({ name: "", email: "", company: "", role: "Portfolio Owner", slot: "This week", notes: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Reset state whenever the modal re-opens
  useEffect(() => {
    if (open) {
      setForm({ name: "", email: "", company: "", role: "Portfolio Owner", slot: "This week", notes: "" });
      setDone(false);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const message = `[BOOK-A-DEMO] Role: ${form.role} · Company: ${form.company || "—"} · Slot: ${form.slot}\n\n${form.notes || "(no notes)"}`;
      await api.post("/contact", { name: form.name, email: form.email, message });
      setDone(true);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="book-demo-modal">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-5 border-b border-[color:var(--line-2)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]">
              <PhoneCall size={14} />
            </div>
            <div>
              <div className="font-mono text-[10px] text-[color:var(--ink-3)]">BOOK A DEMO</div>
              <div className="text-sm text-[color:var(--ink)]">15-minute walk-through</div>
            </div>
          </div>
          <button onClick={onClose} data-testid="book-demo-close" className="p-2 rounded-lg hover:bg-[color:var(--bg-3)] text-[color:var(--ink-3)]">
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center" data-testid="book-demo-done">
            <div className="w-14 h-14 rounded-2xl bg-[color:var(--brand-tint)] text-[color:var(--brand-3)] flex items-center justify-center mx-auto">
              <CheckCircle2 size={26} />
            </div>
            <div className="font-display text-xl mt-4 text-[color:var(--ink)]">Request received</div>
            <p className="text-[color:var(--ink-3)] text-sm mt-2">
              A member of our team will reach out to <strong>{form.email}</strong> within one business day.
            </p>
            <button
              onClick={onClose}
              data-testid="book-demo-close-done"
              className="mt-6 gs-btn-primary text-sm"
            >
              Back to site
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-3" data-testid="book-demo-form">
            <div>
              <label className="text-[10px] font-mono text-[color:var(--ink-3)]">FULL NAME</label>
              <input required data-testid="book-demo-name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} className="gs-input mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[color:var(--ink-3)]">WORK EMAIL</label>
              <input required type="email" data-testid="book-demo-email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} className="gs-input mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[color:var(--ink-3)]">COMPANY</label>
              <input data-testid="book-demo-company" value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })} className="gs-input mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-[color:var(--ink-3)]">YOUR ROLE</label>
                <select data-testid="book-demo-role" value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })} className="gs-input mt-1">
                  {DEMO_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-[color:var(--ink-3)]">TIMING</label>
                <select data-testid="book-demo-slot" value={form.slot}
                  onChange={(e) => setForm({ ...form, slot: e.target.value })} className="gs-input mt-1">
                  {DEMO_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-mono text-[color:var(--ink-3)]">
                WHAT ARE YOU HOPING TO SEE? <span className="opacity-60">(optional)</span>
              </label>
              <textarea data-testid="book-demo-notes" value={form.notes} rows={3}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} className="gs-input mt-1 resize-none" />
            </div>
            <button disabled={busy} data-testid="book-demo-submit" className="gs-btn-primary w-full justify-center text-sm disabled:opacity-60">
              {busy ? <Loader2 className="animate-spin" size={14} /> : <PhoneCall size={14} />}
              {busy ? "Sending..." : "Request Demo"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
