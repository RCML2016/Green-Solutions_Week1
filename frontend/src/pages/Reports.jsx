import { useEffect, useState, useRef } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Mail, Plus, X, Calendar, Send, Power, Image as ImageIcon, Sparkles, Share2, Trash2, ExternalLink, FileText, Loader2 } from "lucide-react";

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

  // Branding
  const [branding, setBranding] = useState({ company_name: "", cover_note: "", logo_data_url: "" });
  const [savingBrand, setSavingBrand] = useState(false);
  const fileRef = useRef(null);

  // Snapshots
  const [snapshots, setSnapshots] = useState([]);
  const [snapLoading, setSnapLoading] = useState(true);

  // Weekly digest
  const [digest, setDigest] = useState(null);
  const [digestBusy, setDigestBusy] = useState(false);

  const loadSnapshots = async () => {
    setSnapLoading(true);
    try {
      const { data } = await api.get("/snapshots");
      setSnapshots(data);
    } catch (e) {
      console.warn("Snapshots load failed:", e?.message);
    } finally { setSnapLoading(false); }
  };

  const revokeSnapshot = async (token) => {
    if (!window.confirm("Revoke this shared snapshot? Anyone with the link will see 'not found'.")) return;
    try {
      await api.delete(`/snapshots/${token}`);
      setSnapshots((s) => s.filter((x) => x.token !== token));
      toast.success("Snapshot revoked");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const generateDigest = async () => {
    setDigestBusy(true);
    try {
      const { data } = await api.post("/reports/weekly-digest");
      setDigest(data);
      toast.success("Weekly digest generated");
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setDigestBusy(false); }
  };

  useEffect(() => {
    (async () => {
      try {
        const [{ data: sched }, { data: br }] = await Promise.all([
          api.get("/reports/schedule"),
          api.get("/reports/branding"),
        ]);
        setCfg({
          frequency: sched.frequency || "weekly",
          recipients: sched.recipients || [],
          enabled: !!sched.enabled,
        });
        setBranding({
          company_name: br.company_name || "",
          cover_note: br.cover_note || "",
          logo_data_url: br.logo_data_url || "",
        });
      } catch (e) {
        console.warn("Reports config load failed:", e?.message);
      }
      finally { setLoading(false); }
    })();
    loadSnapshots();
  }, []);

  const onLogoPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 140_000) return toast.error("Logo must be under 140 KB");
    const reader = new FileReader();
    reader.onload = () => setBranding((b) => ({ ...b, logo_data_url: reader.result }));
    reader.readAsDataURL(file);
  };

  const saveBranding = async () => {
    setSavingBrand(true);
    try { await api.post("/reports/branding", branding); toast.success("Branding saved"); }
    catch (e) { toast.error(formatApiError(e)); }
    finally { setSavingBrand(false); }
  };

  const addRecipient = () => {
    const v = emailInput.trim().toLowerCase();
    if (!v) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return toast.error("Not a valid email");
    if (cfg.recipients.includes(v)) return;
    setCfg({ ...cfg, recipients: [...cfg.recipients, v] });
    setEmailInput("");
  };
  const removeRecipient = (r) => setCfg({ ...cfg, recipients: cfg.recipients.filter((x) => x !== r) });

  const save = async () => {
    setSaving(true);
    try { await api.post("/reports/schedule", cfg); toast.success("Schedule saved"); }
    catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };
  const preview = async () => {
    setPreviewing(true);
    try {
      // Auto-save first so preview uses current config
      await api.post("/reports/schedule", cfg);
      const { data } = await api.post("/reports/preview");
      toast.success(data.message);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setPreviewing(false); }
  };

  return (
    <div className="px-6 lg:px-14 py-10 min-h-[80vh]" data-testid="reports-page">
      <div className="eyebrow">REPORT SCHEDULER</div>
      <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
        Auto-email a <span className="text-[color:var(--brand-3)]">PDF snapshot</span> to stakeholders.
      </h1>
      <p className="text-[color:var(--ink-3)] text-sm mt-2 max-w-xl">
        Choose a cadence and recipient list. When enabled, Green Solutions will render the
        dashboard and deliver it — no manual export needed.
      </p>

      {loading ? (
        <div className="text-[color:var(--ink-3)] text-sm mt-8">Loading schedule...</div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6 mt-10">
          <div className="gs-card p-6">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[color:var(--brand-3)]" />
              <h2 className="font-display text-xl text-[color:var(--ink)]">Cadence</h2>
            </div>
            <div className="grid gap-2 mt-4">
              {FREQS.map((f) => (
                <button key={f.value} onClick={() => setCfg({ ...cfg, frequency: f.value })}
                  data-testid={`freq-${f.value}`}
                  className={`text-left rounded-xl p-4 border transition ${cfg.frequency === f.value ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)]" : "border-[color:var(--line)] hover:border-[color:var(--brand)] bg-white"}`}
                >
                  <div className="text-sm font-medium text-[color:var(--ink)]">{f.label}</div>
                  <div className="text-[11px] text-[color:var(--ink-3)] mt-1">{f.desc}</div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6 rounded-xl border border-[color:var(--line)] bg-white p-4">
              <div className="flex items-center gap-3">
                <Power size={14} className={cfg.enabled ? "text-[color:var(--brand-3)]" : "text-[color:var(--ink-3)]"} />
                <div>
                  <div className="text-sm text-[color:var(--ink)]">Auto-delivery</div>
                  <div className="text-[11px] font-mono text-[color:var(--ink-3)]">{cfg.enabled ? "ACTIVE" : "PAUSED"}</div>
                </div>
              </div>
              <button onClick={() => setCfg({ ...cfg, enabled: !cfg.enabled })}
                data-testid="toggle-enabled"
                className={`w-11 h-6 rounded-full relative transition`}
                style={{ background: cfg.enabled ? "var(--brand)" : "#d5dcd0" }}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition shadow-md ${cfg.enabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          </div>

          <div className="gs-card p-6">
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-[color:var(--brand-3)]" />
              <h2 className="font-display text-xl text-[color:var(--ink)]">Recipients</h2>
            </div>
            <div className="flex gap-2 mt-4">
              <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRecipient())}
                placeholder="owner@example.com" data-testid="recipient-input"
                className="gs-input flex-1" />
              <button type="button" onClick={addRecipient} data-testid="recipient-add"
                className="gs-btn-primary" style={{ padding: "10px 14px" }}>
                <Plus size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-2 max-h-[280px] overflow-y-auto">
              {cfg.recipients.length === 0 ? (
                <div className="text-xs text-[color:var(--ink-3)]">No recipients yet.</div>
              ) : (
                cfg.recipients.map((r) => (
                  <div key={r} className="flex items-center justify-between rounded-lg border border-[color:var(--line)] bg-white px-3 py-2 text-sm" data-testid={`recipient-${r}`}>
                    <span className="text-[color:var(--ink)] truncate">{r}</span>
                    <button onClick={() => removeRecipient(r)} className="p-1 text-[color:var(--ink-3)] hover:text-[color:var(--coral)]" data-testid={`remove-recipient-${r}`}>
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
        <button onClick={save} disabled={saving} data-testid="save-schedule" className="gs-btn-primary disabled:opacity-60">
          {saving ? "Saving..." : "Save Schedule"}
        </button>
        <button onClick={preview} disabled={previewing || cfg.recipients.length === 0}
          data-testid="preview-schedule" className="gs-btn-ghost disabled:opacity-40">
          <Send size={14} /> {previewing ? "Sending..." : "Send Preview"}
        </button>
      </div>

      <div className="mt-8 rounded-xl border border-[color:var(--line)] bg-white p-4 text-[11px] font-mono text-[color:var(--ink-3)]">
        DEMO NOTE · Deliveries are simulated and logged to the backend console. Wire up
        Resend/SendGrid to send real PDFs.
      </div>

      {/* --- Branding --- */}
      <div className="mt-16">
        <div className="eyebrow">CUSTOM BRANDING</div>
        <h2 className="font-display text-2xl md:text-3xl mt-3 text-[color:var(--ink)]">
          Make every exported PDF feel <span className="text-[color:var(--brand-3)]">first-party.</span>
        </h2>
        <p className="text-[color:var(--ink-3)] text-sm mt-2 max-w-xl">
          Add your logo, company name, and a short cover note. Applied automatically on every dashboard export.
        </p>

        <div className="grid lg:grid-cols-2 gap-6 mt-8">
          <div className="gs-card p-6 space-y-4" data-testid="branding-form">
            <div>
              <label className="text-[10px] font-mono text-[color:var(--ink-3)]">COMPANY NAME</label>
              <input
                data-testid="branding-company"
                value={branding.company_name}
                onChange={(e) => setBranding({ ...branding, company_name: e.target.value })}
                className="gs-input mt-1" placeholder="Acme Renewables"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[color:var(--ink-3)]">COVER NOTE</label>
              <textarea
                rows={4} data-testid="branding-note"
                value={branding.cover_note}
                onChange={(e) => setBranding({ ...branding, cover_note: e.target.value })}
                className="gs-input mt-1"
                placeholder="Weekly operations digest for stakeholders..."
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[color:var(--ink-3)]">LOGO (PNG or SVG, ≤140 KB)</label>
              <div className="mt-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="gs-btn-ghost text-sm" style={{ padding: "8px 14px" }}
                  data-testid="branding-logo-pick"
                >
                  <ImageIcon size={14} /> Choose file
                </button>
                <input ref={fileRef} onChange={onLogoPick} type="file" accept="image/*" className="hidden" />
                {branding.logo_data_url && (
                  <button
                    type="button"
                    onClick={() => setBranding({ ...branding, logo_data_url: "" })}
                    className="text-xs text-[color:var(--coral)]"
                    data-testid="branding-logo-clear"
                  >Remove</button>
                )}
              </div>
            </div>
            <button
              onClick={saveBranding} disabled={savingBrand}
              data-testid="branding-save"
              className="gs-btn-primary disabled:opacity-60"
            >
              {savingBrand ? "Saving..." : "Save Branding"}
            </button>
          </div>

          {/* Preview */}
          <div className="gs-card p-6" data-testid="branding-preview">
            <div className="text-[10px] font-mono text-[color:var(--ink-3)]">COVER PAGE PREVIEW</div>
            <div className="mt-3 rounded-xl overflow-hidden bg-white border border-[color:var(--line)]">
              <div className="h-2" style={{ background: "var(--brand)" }} />
              <div className="p-6">
                {branding.logo_data_url ? (
                  <img src={branding.logo_data_url} alt="logo" className="max-h-16 mb-4 object-contain" />
                ) : (
                  <div className="max-h-16 flex items-center text-[color:var(--ink-3)] text-xs mb-4">
                    <Sparkles size={14} className="text-[color:var(--brand-3)] mr-2" /> Your logo appears here
                  </div>
                )}
                <div className="font-display text-2xl text-[color:var(--ink)]">
                  {branding.company_name || "Portfolio Report"}
                </div>
                <div className="text-xs font-mono text-[color:var(--ink-3)] mt-1">
                  Green Solutions · {new Date().toLocaleDateString()}
                </div>
                <p className="text-sm text-[color:var(--ink-2)] mt-6 whitespace-pre-wrap">
                  {branding.cover_note || "Your cover note appears here — perfect for a monthly executive summary or a stakeholder update."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- AI Weekly Digest --- */}
      <div className="mt-16" data-testid="digest-section">
        <div className="eyebrow">AI WEEKLY DIGEST</div>
        <h2 className="font-display text-2xl md:text-3xl mt-3 text-[color:var(--ink)]">
          Claude drafts your <span className="text-[color:var(--brand-3)]">week in plain English.</span>
        </h2>
        <p className="text-[color:var(--ink-3)] text-sm mt-2 max-w-xl">
          Summarises the past 7 days of alerts and accepted actions into a stakeholder-friendly
          digest — ready to paste into email or attach with the PDF.
        </p>
        <div className="mt-6">
          <button
            onClick={generateDigest}
            disabled={digestBusy}
            data-testid="digest-generate"
            className="gs-btn-primary disabled:opacity-60"
          >
            {digestBusy ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />}
            {digestBusy ? "Generating..." : "Generate this week's digest"}
          </button>
          {digest && (
            <div className="gs-card p-6 mt-6" data-testid="digest-result">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono text-[color:var(--ink-3)]">
                  DIGEST · {digest.alerts_count} ALERTS · {digest.actions_count} ACTIONS · {new Date(digest.generated_at).toLocaleString()}
                </div>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(digest.digest);
                      toast.success("Copied");
                    } catch (e) {
                      console.warn("Copy failed:", e?.message);
                      toast.error("Copy failed — select the text manually");
                    }
                  }}
                  data-testid="digest-copy"
                  className="text-[10px] font-mono px-2 py-1 rounded-full border border-[color:var(--line)] hover:border-[color:var(--brand)] hover:text-[color:var(--brand-3)]"
                >
                  COPY
                </button>
              </div>
              <div className="mt-4 text-sm text-[color:var(--ink)] leading-relaxed" data-testid="digest-text">
                {digest.digest.split(/(\*\*.+?\*\*)/g).map((part, i) => {
                  if (part.startsWith("**") && part.endsWith("**")) {
                    return <strong key={i} className="text-[color:var(--ink)] font-semibold">{part.slice(2, -2)}</strong>;
                  }
                  return <span key={i} className="whitespace-pre-wrap">{part}</span>;
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- Snapshot Manager --- */}
      <div className="mt-16" data-testid="snapshots-section">
        <div className="eyebrow">SNAPSHOT MANAGER</div>
        <h2 className="font-display text-2xl md:text-3xl mt-3 text-[color:var(--ink)]">
          Manage every <span className="text-[color:var(--brand-3)]">public share link.</span>
        </h2>
        <p className="text-[color:var(--ink-3)] text-sm mt-2 max-w-xl">
          Every "Share" snapshot lives here for 14 days. Revoke any link to make it immediately return "not found".
        </p>
        <div className="gs-card p-4 mt-6" data-testid="snapshots-list">
          {snapLoading ? (
            <div className="text-sm text-[color:var(--ink-3)] p-4">Loading snapshots...</div>
          ) : snapshots.length === 0 ? (
            <div className="text-sm text-[color:var(--ink-3)] p-4 text-center">
              No shared snapshots yet. Use the Share button on the dashboard.
            </div>
          ) : (
            <div className="divide-y divide-[color:var(--line-2)]">
              {snapshots.map((s) => (
                <div key={s.token} className="p-4 flex items-center gap-3 flex-wrap" data-testid={`snapshot-${s.token}`}>
                  <Share2 size={14} className="text-[color:var(--brand-3)]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[color:var(--ink)] truncate">
                      {s.title && !s.title.startsWith("20") ? s.title : `Snapshot · ${new Date(s.created_at).toLocaleString()}`}
                    </div>
                    <div className="text-[10px] font-mono text-[color:var(--ink-3)] mt-1">
                      TOKEN {s.token.slice(0, 12)}… · EXPIRES {new Date(s.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                  <a
                    href={`/s/${s.token}`} target="_blank" rel="noreferrer"
                    data-testid={`snapshot-open-${s.token}`}
                    className="text-[10px] font-mono px-2 py-1 rounded-full border border-[color:var(--line)] hover:border-[color:var(--brand)] hover:text-[color:var(--brand-3)] flex items-center gap-1"
                  >
                    <ExternalLink size={11} /> OPEN
                  </a>
                  <button
                    onClick={() => revokeSnapshot(s.token)}
                    data-testid={`snapshot-revoke-${s.token}`}
                    className="text-[10px] font-mono px-2 py-1 rounded-full border border-[color:var(--line)] text-[color:var(--coral)] hover:border-[color:var(--coral)] hover:bg-[color:var(--coral-tint)] flex items-center gap-1"
                  >
                    <Trash2 size={11} /> REVOKE
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
