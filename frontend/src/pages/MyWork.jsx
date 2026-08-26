import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import {
  ClipboardList, AlertTriangle, Wrench, ArrowRight, Loader2, CheckCircle2, Bot,
} from "lucide-react";
import { toast } from "sonner";

/**
 * My Work — Technician workspace.
 * Mobile-first: assigned alarms list, quick "start" / "resolve" actions,
 * AI troubleshooting shortcut for each item.
 */
export default function MyWork() {
  const { user } = useAuth();
  const [alarms, setAlarms] = useState([]);
  const [wos, setWos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      // For MVP: any HIGH/CRITICAL open alarms are "assigned to this technician"
      api.get("/fleet/alarms", { params: { severity: "High", status: "Open", limit: 8 } }),
      api.get("/fleet/work-orders", { params: { status: "Dispatched", limit: 8 } }),
    ])
      .then(([a, w]) => {
        if (!mounted) return;
        setAlarms(a.data.items);
        setWos(w.data.items);
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const ack = async (alarm) => {
    try {
      // Log via existing legacy /alerts flow so it appears in the admin Alert Center too.
      await api.post("/alerts", {
        code: alarm.alarm_id,
        title: alarm.root_cause_category,
        severity: alarm.severity.toLowerCase(),
        confidence: 90,
      });
      await api.post("/actions", {
        finding_code: alarm.alarm_id,
        finding_title: alarm.root_cause_category,
        action_text: `Acknowledged from My Work by ${user?.name}`,
      });
      toast.success("Marked in progress");
      setAlarms((list) => list.filter((x) => x.alarm_id !== alarm.alarm_id));
    } catch {
      toast.error("Could not update — check permissions");
    }
  };

  if (loading) {
    return (
      <div className="px-6 lg:px-14 py-16 flex items-center gap-2 text-[color:var(--ink-3)]">
        <Loader2 className="animate-spin" size={14} /> Loading your queue…
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-14 py-10 max-w-full overflow-x-hidden" data-testid="my-work-page">
      <div className="eyebrow flex items-center gap-2">
        <ClipboardList size={12} /> MY WORK
      </div>
      <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
        {alarms.length + wos.length} items <span className="text-[color:var(--brand-3)]">for you today</span>
      </h1>
      <p className="text-[color:var(--ink-3)] text-sm mt-2">
        High-severity alarms and dispatched work orders — tap any card to open the site & diagnose with AI.
      </p>

      {/* Assigned alarms */}
      <div className="mt-8">
        <div className="font-mono text-[10px] text-[color:var(--ink-3)] mb-3">HIGH-SEVERITY ALARMS · {alarms.length}</div>
        {alarms.length === 0 ? (
          <div className="gs-card p-6 text-center text-[color:var(--ink-3)] text-sm">
            <CheckCircle2 size={20} className="mx-auto text-[color:var(--brand-3)] mb-2" />
            No urgent alarms. Nice work.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {alarms.map((a) => (
              <div key={a.alarm_id} className="gs-card p-5" data-testid={`mywork-alarm-${a.alarm_id}`}>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#fee2e2] text-[#b91c1c]">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[color:var(--brand-3)]">{a.alarm_id}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full text-[#b91c1c] bg-[#fee2e2]">
                        {a.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm text-[color:var(--ink)] mt-1">{a.root_cause_category}</div>
                    <div className="text-[10px] font-mono text-[color:var(--ink-3)] mt-0.5">
                      {a.site_id} · {a.asset_id} · {a.duration_hours}h open
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Link
                    to={`/site/${a.site_id}`}
                    className="text-[11px] font-mono text-[color:var(--brand-3)] hover:underline inline-flex items-center gap-1"
                    data-testid={`mywork-open-${a.alarm_id}`}
                  >
                    Open site <ArrowRight size={11} />
                  </Link>
                  <button
                    onClick={() => ack(a)}
                    data-testid={`mywork-ack-${a.alarm_id}`}
                    className="text-[10px] font-mono px-3 py-1.5 rounded-full border border-[color:var(--brand)] text-[color:var(--brand-3)] bg-[color:var(--brand-tint)] hover:bg-white transition"
                  >
                    <Bot size={11} className="inline mr-1" /> START
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dispatched WOs */}
      <div className="mt-10">
        <div className="font-mono text-[10px] text-[color:var(--ink-3)] mb-3">DISPATCHED WORK ORDERS · {wos.length}</div>
        {wos.length === 0 ? (
          <div className="gs-card p-6 text-center text-[color:var(--ink-3)] text-sm">
            No dispatched work orders in your queue.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {wos.map((wo) => (
              <Link
                key={wo.work_order_id}
                to={`/site/${wo.site_id}`}
                className="gs-card p-5 hover:border-[color:var(--brand)] transition"
                data-testid={`mywork-wo-${wo.work_order_id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[color:var(--brand-tint)] text-[color:var(--brand-3)]">
                    <Wrench size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[color:var(--brand-3)]">{wo.work_order_id}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full text-[#b45309] bg-[#fef3c7]">
                        {wo.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm text-[color:var(--ink)] mt-1">{wo.resolution_action}</div>
                    <div className="text-[10px] font-mono text-[color:var(--ink-3)] mt-0.5">
                      {wo.site_id} · {wo.trade} · {wo.labor_hours}h · ${wo.parts_cost_usd}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
