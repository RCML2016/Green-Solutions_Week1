import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await register(form.name, form.email, form.password);
    setBusy(false);
    if (res.ok) {
      toast.success("Account created");
      navigate("/dashboard");
    } else {
      setErr(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#062015] text-white flex items-center justify-center px-6 py-14">
      <div className="w-full max-w-md">
        <Link to="/" className="text-white/60 hover:text-white text-sm inline-flex items-center gap-2 mb-8">
          <ArrowLeft size={14} /> Back to site
        </Link>
        <div className="eyebrow">CREATE ACCOUNT</div>
        <h1 className="font-display text-3xl mt-3">Start your intelligence journey.</h1>
        <p className="text-white/55 text-sm mt-2">Free demo account. No credit card needed.</p>
        <form onSubmit={submit} data-testid="register-form" className="mt-8 space-y-4">
          <div>
            <label className="text-xs font-mono text-white/50">FULL NAME</label>
            <input
              required
              data-testid="register-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22d17a] text-white"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-white/50">EMAIL</label>
            <input
              required
              type="email"
              data-testid="register-email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22d17a] text-white"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-white/50">PASSWORD</label>
            <input
              required
              minLength={6}
              type="password"
              data-testid="register-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22d17a] text-white"
            />
            <div className="text-[11px] text-white/40 mt-1">Minimum 6 characters</div>
          </div>
          {err && (
            <div data-testid="register-error" className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
          <button
            disabled={busy}
            data-testid="register-submit"
            className="gs-btn-primary w-full justify-center disabled:opacity-60"
          >
            {busy ? "Creating..." : "Create Account"}
          </button>
        </form>
        <div className="mt-6 text-sm text-white/60">
          Already have an account?{" "}
          <Link to="/login" className="text-[#6dfcb2] hover:text-[#22d17a]" data-testid="register-to-login">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
