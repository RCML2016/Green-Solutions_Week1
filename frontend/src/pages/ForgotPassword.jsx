import { Link } from "react-router-dom";
import { useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setResult(data);
    } catch (er) {
      setErr(formatApiError(er));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#062015] text-white flex items-center justify-center px-6 py-14">
      <div className="w-full max-w-md">
        <Link to="/login" className="text-white/60 hover:text-white text-sm inline-flex items-center gap-2 mb-8">
          <ArrowLeft size={14} /> Back to sign in
        </Link>
        <div className="eyebrow">PASSWORD RECOVERY</div>
        <h1 className="font-display text-3xl mt-3">Reset your password.</h1>
        <p className="text-white/55 text-sm mt-2">
          Enter your email. If we find your account, we'll generate a secure reset link.
        </p>

        {!result ? (
          <form onSubmit={submit} data-testid="forgot-form" className="mt-8 space-y-4">
            <div>
              <label className="text-xs font-mono text-white/50">EMAIL</label>
              <input
                required
                type="email"
                data-testid="forgot-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22d17a] text-white"
              />
            </div>
            {err && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {err}
              </div>
            )}
            <button
              disabled={busy}
              data-testid="forgot-submit"
              className="gs-btn-primary w-full justify-center disabled:opacity-60"
            >
              {busy ? "Generating..." : "Send Reset Link"}
            </button>
          </form>
        ) : (
          <div data-testid="forgot-result" className="mt-8 space-y-4">
            <div className="rounded-xl border border-[#22d17a]/30 bg-[#22d17a]/5 px-4 py-3 text-sm text-[#6dfcb2]">
              {result.message}
            </div>
            {result.demo_reset_link && (
              <div className="rounded-xl border border-white/10 p-4">
                <div className="text-[10px] font-mono text-white/40 mb-2">DEMO · RESET LINK (also logged server-side)</div>
                <Link
                  to={result.demo_reset_link.replace(/^https?:\/\/[^/]+/, "")}
                  data-testid="forgot-open-link"
                  className="text-xs text-[#6dfcb2] hover:text-[#22d17a] break-all"
                >
                  {result.demo_reset_link}
                </Link>
              </div>
            )}
            <Link to="/login" className="text-sm text-white/60 hover:text-white">
              ← Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
