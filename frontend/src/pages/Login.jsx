import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await login(form.email, form.password);
    setBusy(false);
    if (res.ok) {
      toast.success("Welcome back");
      navigate(location.state?.from || "/dashboard");
    } else {
      setErr(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#062015] text-white flex">
      {/* Left visual pane */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-[#04180f]">
        <div className="absolute inset-0 gs-grain opacity-60" />
        <div className="relative m-auto max-w-md px-14">
          <Link to="/" className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-16">
            <ArrowLeft size={14} /> Back to site
          </Link>
          <div className="flex items-end gap-1 h-8 mb-8">
            <span className="w-2 h-3 bg-[#22d17a] rounded-sm" />
            <span className="w-2 h-5 bg-[#22d17a] rounded-sm" />
            <span className="w-2 h-8 bg-[#22d17a] rounded-sm" />
          </div>
          <h2 className="font-display text-4xl leading-tight">
            Sign in to your <br /> renewable <span className="text-[#22d17a]">intelligence.</span>
          </h2>
          <p className="text-white/60 mt-6 text-sm max-w-sm">
            Access live portfolio health, AI findings and operational actions from
            a single command center.
          </p>
          <div className="mt-14 flex items-center gap-2 text-[11px] font-mono text-white/40">
            <span className="pulse-dot" /> LIVE · MONITORING 128 ASSETS
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-14">
        <form onSubmit={submit} data-testid="login-form" className="w-full max-w-md">
          <Link to="/" className="lg:hidden text-white/60 hover:text-white text-sm inline-flex items-center gap-2 mb-8">
            <ArrowLeft size={14} /> Back
          </Link>
          <div className="eyebrow">SIGN IN</div>
          <h1 className="font-display text-3xl mt-3">Welcome back.</h1>
          <p className="text-white/55 text-sm mt-2">Sign in to access the live intelligence dashboard.</p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="text-xs font-mono text-white/50">EMAIL</label>
              <input
                required
                type="email"
                data-testid="login-email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22d17a] text-white"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-white/50">PASSWORD</label>
              <input
                required
                type="password"
                data-testid="login-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22d17a] text-white"
              />
            </div>
            {err && (
              <div data-testid="login-error" className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {err}
              </div>
            )}
            <button
              disabled={busy}
              data-testid="login-submit"
              className="gs-btn-primary w-full justify-center disabled:opacity-60"
            >
              {busy ? "Signing in..." : "Sign In"}
            </button>
          </div>

          <div className="mt-8 rounded-xl border border-white/10 p-4 text-xs text-white/60 font-mono">
            <div className="text-white/40 mb-1">DEMO ACCOUNT</div>
            admin@greensolutions.ai · Admin@123
          </div>

          <div className="mt-6 text-sm text-white/60 flex justify-between">
            <Link to="/register" className="text-[#6dfcb2] hover:text-[#22d17a]" data-testid="login-to-register">
              Create an account
            </Link>
            <Link to="/forgot-password" className="text-white/60 hover:text-white" data-testid="login-forgot">
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
