import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (pwd !== pwd2) return setErr("Passwords do not match.");
    setBusy(true);
    try { await api.post("/auth/reset-password", { token, new_password: pwd }); toast.success("Password updated. Please sign in."); navigate("/login"); }
    catch (er) { setErr(formatApiError(er)); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-white gs-canvas flex items-center justify-center px-6 py-14">
      <div className="w-full max-w-md">
        <Link to="/login" className="text-[color:var(--ink-2)] text-sm inline-flex items-center gap-2 mb-8">
          <ArrowLeft size={14} /> Back to sign in
        </Link>
        <div className="eyebrow">NEW PASSWORD</div>
        <h1 className="font-display text-3xl mt-3 text-[color:var(--ink)]">Choose a new password.</h1>
        <p className="text-[color:var(--ink-3)] text-sm mt-2">Minimum 6 characters. Keep it safe.</p>

        {!token && (
          <div className="mt-6 text-sm text-[color:var(--coral)] bg-[color:var(--coral-tint)] border border-[#fecaca] rounded-lg px-3 py-2">
            Missing or invalid reset token.
          </div>
        )}

        <form onSubmit={submit} data-testid="reset-form" className="mt-8 space-y-4">
          <div>
            <label className="text-xs font-mono text-[color:var(--ink-3)]">NEW PASSWORD</label>
            <input required type="password" minLength={6} data-testid="reset-password-input"
              value={pwd} onChange={(e) => setPwd(e.target.value)}
              className="gs-input mt-1" />
          </div>
          <div>
            <label className="text-xs font-mono text-[color:var(--ink-3)]">CONFIRM PASSWORD</label>
            <input required type="password" minLength={6} data-testid="reset-password-confirm"
              value={pwd2} onChange={(e) => setPwd2(e.target.value)}
              className="gs-input mt-1" />
          </div>
          {err && (
            <div data-testid="reset-error" className="text-sm text-[color:var(--coral)] bg-[color:var(--coral-tint)] border border-[#fecaca] rounded-lg px-3 py-2">
              {err}
            </div>
          )}
          <button disabled={busy || !token} data-testid="reset-submit" className="gs-btn-primary w-full justify-center disabled:opacity-60">
            {busy ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
