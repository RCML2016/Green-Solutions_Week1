import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";
import { landingFor } from "@/lib/roles";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await login(form.email, form.password);
    setBusy(false);
    if (res.ok) {
      toast.success("Welcome back");
      const dest = location.state?.from || landingFor(res.user?.role);
      navigate(dest);
    }
    else setErr(res.error);
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left shine panel */}
      <div
        className="hidden lg:flex w-1/2 relative overflow-hidden"
        style={{
          background:
            "radial-gradient(900px 500px at 20% 10%, rgba(52,211,153,0.35), transparent 60%)," +
            "radial-gradient(700px 400px at 90% 90%, rgba(253,224,71,0.20), transparent 60%)," +
            "linear-gradient(160deg, #ecfef4 0%, #f6f9f2 100%)",
        }}
      >
        <div className="absolute inset-0 gs-grain opacity-40" />
        <div className="relative m-auto max-w-md px-14">
          <Link to="/" className="flex items-center gap-2 text-[color:var(--ink-2)] hover:text-[color:var(--ink)] text-sm mb-16">
            <ArrowLeft size={14} /> Back to site
          </Link>
          <div className="flex items-end gap-1 h-8 mb-8">
            <span className="w-2 h-3 rounded-sm" style={{ background: "var(--brand)" }} />
            <span className="w-2 h-5 rounded-sm" style={{ background: "var(--brand-2)" }} />
            <span className="w-2 h-8 rounded-sm" style={{ background: "var(--brand-3)" }} />
          </div>
          <h2 className="font-display text-4xl leading-tight text-[color:var(--ink)]">
            Sign in to your <br /> renewable <span className="text-[color:var(--brand-3)]">intelligence.</span>
          </h2>
          <p className="text-[color:var(--ink-2)] mt-6 text-sm max-w-sm">
            Access live portfolio health, AI findings and operational actions from a single command center.
          </p>
          <div className="mt-10 flex items-center gap-3 rounded-xl bg-white border border-[color:var(--line)] px-4 py-3 max-w-sm shadow-[0_10px_30px_-20px_rgba(16,185,129,0.35)]">
            <Sparkles size={14} className="text-[color:var(--brand-3)]" />
            <div className="text-xs text-[color:var(--ink-2)]">Powered by Claude Sonnet 5 — explainable, auditable AI</div>
          </div>
          <div className="mt-8 flex items-center gap-2 text-[11px] font-mono text-[color:var(--ink-3)]">
            <span className="pulse-dot" /> LIVE · MONITORING 380 SITES · 5,473 ASSETS
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-14">
        <form onSubmit={submit} data-testid="login-form" className="w-full max-w-md">
          <Link to="/" className="lg:hidden text-[color:var(--ink-2)] text-sm inline-flex items-center gap-2 mb-8">
            <ArrowLeft size={14} /> Back
          </Link>
          <div className="eyebrow">SIGN IN</div>
          <h1 className="font-display text-3xl mt-3 text-[color:var(--ink)]">Welcome back.</h1>
          <p className="text-[color:var(--ink-3)] text-sm mt-2">Sign in to access the live intelligence dashboard.</p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="text-xs font-mono text-[color:var(--ink-3)]">EMAIL</label>
              <input required type="email" data-testid="login-email"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="gs-input mt-1" />
            </div>
            <div>
              <label className="text-xs font-mono text-[color:var(--ink-3)]">PASSWORD</label>
              <input required type="password" data-testid="login-password"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="gs-input mt-1" />
            </div>
            {err && (
              <div data-testid="login-error" className="text-sm text-[color:var(--coral)] bg-[color:var(--coral-tint)] border border-[#fecaca] rounded-lg px-3 py-2">
                {err}
              </div>
            )}
            <button disabled={busy} data-testid="login-submit" className="gs-btn-primary w-full justify-center disabled:opacity-60">
              {busy ? "Signing in..." : "Sign In"}
            </button>
          </div>

          <div className="mt-8 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-3)] p-4 text-xs text-[color:var(--ink-2)] font-mono space-y-1">
            <div className="text-[color:var(--ink-3)] mb-1">DEMO ACCOUNTS · TRY ANY ROLE</div>
            <div>admin@assetnova.com · Admin@123</div>
            <div>executive@assetnova.com · Executive@123</div>
            <div>assetmgr@assetnova.com · Asset@123</div>
            <div>ops@assetnova.com · Ops@123</div>
            <div>tech@assetnova.com · Tech@123</div>
            <div>perf@assetnova.com · Perf@123</div>
            <div>client@assetnova.com · Client@123</div>
          </div>

          <div className="mt-6 text-sm text-[color:var(--ink-2)] flex justify-between">
            <Link to="/register" className="text-[color:var(--brand-3)] hover:text-[color:var(--brand)]" data-testid="login-to-register">
              Create an account
            </Link>
            <Link to="/forgot-password" className="text-[color:var(--ink-3)] hover:text-[color:var(--ink)]" data-testid="login-forgot">
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
