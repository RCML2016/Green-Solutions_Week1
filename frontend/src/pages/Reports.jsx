import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Mail, Plus, X, Calendar, Send, Power } from "lucide-react";

const FREQS = [
  { value: "daily", label: "Daily", desc: "Every business day at 08:00 local" },
  { value: "weekly", label: "Weekly", desc: "Every Monday morning" },
  { value: "monthly", label: "Monthly", desc: "First of every month" },
];

export default function Reports() {
  const [cfg, setCfg] = useState({ frequency: "weekly", recipients: [], enabled: false });
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/reports/schedule");
        setCfg({
          frequency: data.frequency || "weekly",
          recipients: data.recipients || [],
          enabled: !!data.enabled,
        });
      } catch (e) { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const addRecipient = () => {
    const v = emailInput.trim().toLowerCase();
    if (!v) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      toast.error("Not a valid email");
      return;
    }
    if (cfg.recipients.includes(v)) return;
    setCfg({ ...cfg, recipients: [...cfg.recipients, v] });
    setEmailInput("");
  };

  const removeRecipient = (r) => setCfg({ ...cfg, recipients: cfg.recipients.filter((x) => x !== r) });

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/reports/schedule", cfg);
      toast.success("Schedule saved");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const preview = async () => {
    setPreviewing(true);
    try {
      const { data } = await api.post("/reports/preview");
      toast.success(data.message);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="px-6 lg:px-14 py-10 min-h-[80vh]" data-testid="reports-page">
      <div className="eyebrow">REPORT SCHEDULER</div>
      <h1 className="font-display text-3xl md:text-4xl mt-3">
        Auto-email a <span className="text-[#22d17a]">PDF snapshot</span> to stakeholders.
      </h1>
      <p className="text-white/55 text-sm mt-2 max-w-xl">
        Choose a cadence and recipient list. When enabled, Green Solutions will render the
        dashboard and deliver it — no manual export needed.
      </p>

      {loading ? (
        <div className="text-white/50 text-sm mt-8">Loading schedule...</div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6 mt-10">
          <div className="rounded-2xl bg-[#0a2e1e] border border-white/5 p-6">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#6dfcb2]" />
              <h2 className="font-display text-xl">Cadence</h2>
            </div>
            <div className="grid gap-2 mt-4">
              {FREQS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setCfg({ ...cfg, frequency: f.value })}
                  data-testid={`freq-${f.value}`}
                  className={`text-left rounded-xl p-4 border transition ${cfg.frequency === f.value ? "border-[#22d17a] bg-[#22d17a]/10" : "border-white/10 hover:border-white/25"}`}
                >
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="text-[11px] text-white/50 mt-1">{f.desc}</div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6 rounded-xl border border-white/10 p-4">
              <div className="flex items-center gap-3">
                <Power size={14} className={cfg.enabled ? "text-[#22d17a]" : "text-white/40"} />
                <div>
                  <div className="text-sm">Auto-delivery</div>
                  <div className="text-[11px] font-mono text-white/40">{cfg.enabled ? "ACTIVE" : "PAUSED"}</div>
                </div>
              </div>
              <button
                onClick={() => setCfg({ ...cfg, enabled: !cfg.enabled })}
                data-testid="toggle-enabled"
                className={`w-11 h-6 rounded-full relative transition ${cfg.enabled ? "bg-[#22d17a]" : "bg-white/15"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${cfg.enabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0a2e1e] border border-white/5 p-6">
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-[#6dfcb2]" />
              <h2 className="font-display text-xl">Recipients</h2>
            </div>
            <div className="flex gap-2 mt-4">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRecipient())}
                placeholder="owner@example.com"
                data-testid="recipient-input"
                className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#22d17a] text-white"
              />
              <button
                type="button"
                onClick={addRecipient}
                data-testid="recipient-add"
                className="rounded-xl px-3 bg-[#22d17a] text-[#062015] hover:bg-[#6dfcb2]"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-2 max-h-[280px] overflow-y-auto">
              {cfg.recipients.length === 0 ? (
                <div className="text-xs text-white/40">No recipients yet.</div>
              ) : (
                cfg.recipients.map((r) => (
                  <div key={r} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm" data-testid={`recipient-${r}`}>
                    <span className="text-white/85 truncate">{r}</span>
                    <button onClick={() => removeRecipient(r)} className="p-1 text-white/40 hover:text-red-300" data-testid={`remove-recipient-${r}`}>
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-8">
        <button
          onClick={save}
          disabled={saving}
          data-testid="save-schedule"
          className="gs-btn-primary disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Schedule"}
        </button>
        <button
          onClick={preview}
          disabled={previewing || cfg.recipients.length === 0}
          data-testid="preview-schedule"
          className="gs-btn-ghost text-white disabled:opacity-40"
        >
          <Send size={14} /> {previewing ? "Sending..." : "Send Preview"}
        </button>
      </div>

      <div className="mt-8 rounded-xl border border-white/5 bg-[#04180f] p-4 text-[11px] font-mono text-white/50">
        DEMO NOTE · Deliveries are simulated and logged to the backend console. Wire up
        Resend/SendGrid to send real PDFs.
      </div>
    </div>
  );
}
