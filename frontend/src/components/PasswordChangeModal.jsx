import { useState } from "react";
import { X, KeyRound } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function PasswordChangeModal({ open, onClose }) {
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (form.new_password !== form.confirm) return setErr("New passwords do not match.");
    setBusy(true);
    try {
      await api.post("/auth/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      toast.success("Password updated");
      setForm({ current_password: "", new_password: "", confirm: "" });
      onClose();
    } catch (er) { setErr(formatApiError(er)); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" data-testid="password-modal">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative gs-card w-full max-w-md p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[color:var(--brand-tint)] text-[color:var(--brand-3)] flex items-center justify-center">
              <KeyRound size={16} />
            </div>
            <div>
              <div className="text-[10px] font-mono text-[color:var(--ink-3)]">SECURITY</div>
              <h3 className="font-display text-xl text-[color:var(--ink)]">Change your password</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[color:var(--bg-3)] text-[color:var(--ink-3)]" data-testid="password-modal-close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} data-testid="password-change-form" className="mt-5 space-y-3">
          <div>
            <label className="text-[10px] font-mono text-[color:var(--ink-3)]">CURRENT PASSWORD</label>
            <input required type="password" data-testid="password-current"
              value={form.current_password}
              onChange={(e) => setForm({ ...form, current_password: e.target.value })}
              className="gs-input mt-1" />
          </div>
          <div>
            <label className="text-[10px] font-mono text-[color:var(--ink-3)]">NEW PASSWORD</label>
            <input required minLength={6} type="password" data-testid="password-new"
              value={form.new_password}
              onChange={(e) => setForm({ ...form, new_password: e.target.value })}
              className="gs-input mt-1" />
          </div>
          <div>
            <label className="text-[10px] font-mono text-[color:var(--ink-3)]">CONFIRM NEW PASSWORD</label>
            <input required minLength={6} type="password" data-testid="password-confirm"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              className="gs-input mt-1" />
          </div>
          {err && (
            <div data-testid="password-error" className="text-sm text-[color:var(--coral)] bg-[color:var(--coral-tint)] border border-[#fecaca] rounded-lg px-3 py-2">
              {err}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="gs-btn-ghost text-sm" style={{ padding: "8px 16px" }}>
              Cancel
            </button>
            <button disabled={busy} type="submit" data-testid="password-submit" className="gs-btn-primary text-sm disabled:opacity-60" style={{ padding: "8px 16px" }}>
              {busy ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
