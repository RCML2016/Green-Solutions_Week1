import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { CheckCircle2, XCircle, Circle, Ban, Loader2, ShieldCheck, Search, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STATUSES = ["Not Run", "Passed", "Failed", "Blocked"];
const STATUS_ICON = {
  "Not Run": Circle,
  "Passed":  CheckCircle2,
  "Failed":  XCircle,
  "Blocked": Ban,
};
const STATUS_COLOR = {
  "Not Run": "text-[color:var(--ink-3)]",
  "Passed":  "text-[color:var(--brand-3)]",
  "Failed":  "text-red-500",
  "Blocked": "text-amber-500",
};
const PRIO_COLOR = {
  P0: "bg-red-100 text-red-700 border-red-200",
  P1: "bg-amber-100 text-amber-700 border-amber-200",
  P2: "bg-blue-100 text-blue-700 border-blue-200",
};

/** Admin-only in-app manual test-run tracker. Sources test cases from
 *  the same generator that produces the XLSX so both artefacts stay
 *  in sync. Persists tester ticks to Mongo via /api/qa/*. */
export default function QaTracker() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [summary, setSummary] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [q, setQ] = useState("");
  const [prioFilter, setPrioFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const load = async () => {
    setLoading(true);
    try {
      const [tc, s] = await Promise.all([
        api.get("/qa/test-cases"),
        api.get("/qa/summary"),
      ]);
      setCases(tc.data.test_cases);
      setSummary(s.data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (prioFilter !== "All" && c.prio !== prioFilter) return false;
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (q) {
        const hay = `${c.id} ${c.title} ${c.role} ${c.feature}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [cases, q, prioFilter, statusFilter]);

  // Non-admin bounce — placed AFTER all hooks so hook order stays stable.
  if (user && user.role !== "admin") return <Navigate to="/" replace />;

  const saveStatus = async (test_id, status, notes = "") => {
    setSavingId(test_id);
    try {
      await api.post("/qa/results", { test_id, status, notes });
      setCases((prev) => prev.map((c) => c.id === test_id ? { ...c, status, notes, last_run_at: new Date().toISOString(), last_run_by: user.email } : c));
      // Refresh summary in background
      api.get("/qa/summary").then((s) => setSummary(s.data)).catch(() => {});
      toast.success(`${test_id} → ${status}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center gap-2 text-[color:var(--ink-3)]" data-testid="qa-tracker-loading">
        <Loader2 size={18} className="animate-spin" /> Loading test cases…
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1600px] mx-auto" data-testid="qa-tracker-page">
      <div className="eyebrow flex items-center gap-2">
        <ShieldCheck size={12} /> QA · MANUAL TEST TRACKER
      </div>
      <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
        Manual test <span className="text-[color:var(--brand-3)]">runbook</span>
      </h1>
      <p className="text-[color:var(--ink-3)] text-sm mt-2">
        Tick each case as you run it. Latest status per test is stored to Mongo and re-surfaces here.
      </p>

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6" data-testid="qa-summary-strip">
          <StatCard label="TOTAL" value={summary.total} />
          <StatCard label="PASS RATE" value={`${summary.pass_rate_pct}%`} tone="brand" />
          <StatCard label="PASSED" value={summary.counts.Passed} tone="pass" />
          <StatCard label="FAILED" value={summary.counts.Failed} tone="fail" />
          <StatCard label="NOT RUN" value={summary.counts["Not Run"]} tone="muted" />
        </div>
      )}

      {/* Filters */}
      <div className="gs-card p-4 mt-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-3)]" />
          <input
            data-testid="qa-search"
            placeholder="Search by ID, title, role, feature…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="gs-input pl-9 pr-3 py-2 text-sm w-72"
          />
        </div>
        <FilterGroup label="Priority" value={prioFilter} setValue={setPrioFilter} options={["All", "P0", "P1", "P2"]} testid="qa-filter-prio" />
        <FilterGroup label="Status"   value={statusFilter} setValue={setStatusFilter} options={["All", ...STATUSES]} testid="qa-filter-status" />
        <div className="ml-auto text-xs font-mono text-[color:var(--ink-3)]">
          Showing {filtered.length} / {cases.length}
        </div>
      </div>

      {/* Case list */}
      <div className="mt-4 space-y-2">
        {filtered.map((c) => (
          <TestCaseRow
            key={c.id}
            tc={c}
            saving={savingId === c.id}
            onStatus={(s) => saveStatus(c.id, s, c.notes || "")}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-sm text-[color:var(--ink-3)]" data-testid="qa-empty">
            No test cases match your filters.
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = "default" }) {
  const toneClass = {
    default: "text-[color:var(--ink)]",
    brand: "text-[color:var(--brand-3)]",
    pass: "text-[color:var(--brand-3)]",
    fail: "text-red-500",
    muted: "text-[color:var(--ink-3)]",
  }[tone];
  return (
    <div className="gs-card p-4" data-testid={`qa-stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="text-[10px] font-mono text-[color:var(--ink-3)]">{label}</div>
      <div className={`font-display text-3xl mt-1 tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function FilterGroup({ label, value, setValue, options, testid }) {
  return (
    <div className="flex items-center gap-1" data-testid={testid}>
      <span className="text-[10px] font-mono text-[color:var(--ink-3)] mr-1">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => setValue(o)}
          className={`text-xs px-2.5 py-1 rounded-full border transition ${
            value === o
              ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]"
              : "border-[color:var(--line)] text-[color:var(--ink-2)] hover:border-[color:var(--brand)]"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function TestCaseRow({ tc, saving, onStatus }) {
  const [expanded, setExpanded] = useState(false);
  const StatusIcon = STATUS_ICON[tc.status] || Circle;
  return (
    <div className="gs-card p-4 hover:border-[color:var(--brand)] transition" data-testid={`qa-tc-${tc.id}`}>
      <div className="flex items-start gap-4">
        <StatusIcon size={20} className={`${STATUS_COLOR[tc.status]} flex-shrink-0 mt-0.5`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-[color:var(--ink-3)]">{tc.id}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${PRIO_COLOR[tc.prio]}`}>{tc.prio}</span>
            <span className="text-[10px] font-mono text-[color:var(--ink-3)]">{tc.role} · {tc.feature}</span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-left text-sm text-[color:var(--ink)] font-medium hover:text-[color:var(--brand-3)] transition"
            data-testid={`qa-tc-toggle-${tc.id}`}
          >
            {tc.title}
          </button>
          {expanded && (
            <div className="mt-3 grid md:grid-cols-2 gap-4 text-xs text-[color:var(--ink-2)]">
              <div>
                <div className="text-[10px] font-mono text-[color:var(--ink-3)] mb-1">PRECONDITIONS</div>
                <div>{tc.pre || "—"}</div>
                <div className="text-[10px] font-mono text-[color:var(--ink-3)] mb-1 mt-3">STEPS</div>
                <ol className="list-decimal ml-4 space-y-1">
                  {tc.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
              <div>
                <div className="text-[10px] font-mono text-[color:var(--ink-3)] mb-1">EXPECTED RESULT</div>
                <div>{tc.expected}</div>
                {tc.last_run_at && (
                  <div className="mt-3 text-[10px] font-mono text-[color:var(--ink-3)]">
                    LAST RUN · {new Date(tc.last_run_at).toLocaleString()} by {tc.last_run_by || "unknown"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => onStatus(s)}
              disabled={saving}
              className={`text-[11px] px-2 py-1 rounded border transition disabled:opacity-50 ${
                tc.status === s
                  ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]"
                  : "border-[color:var(--line)] text-[color:var(--ink-2)] hover:border-[color:var(--brand)]"
              }`}
              data-testid={`qa-tc-${tc.id}-set-${s.toLowerCase().replace(/\s/g, "-")}`}
            >
              {s === "Not Run" ? "Reset" : s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
