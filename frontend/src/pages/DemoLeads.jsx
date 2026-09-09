import { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Inbox, Mail, Loader2, CheckCircle2, Circle, Archive } from "lucide-react";

const STATUS_META = {
  new: { label: "New", color: "bg-amber-50 text-amber-900 border-amber-200", icon: Circle },
  contacted: { label: "Contacted", color: "bg-blue-50 text-blue-900 border-blue-200", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-[color:var(--bg-3)] text-[color:var(--ink-3)] border-[color:var(--line-2)]", icon: Archive },
};
const TABS = ["all", "new", "contacted", "closed"];

export default function DemoLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/leads", { params: { limit: 200 } });
      setLeads(data.leads || []);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (lead, status) => {
    setBusyId(lead.id);
    try {
      await api.patch(`/admin/leads/${lead.id}`, { status });
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)));
      toast.success(`Marked ${lead.name} as ${status}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const c = { all: leads.length, new: 0, contacted: 0, closed: 0 };
    leads.forEach((l) => { c[l.status || "new"] = (c[l.status || "new"] || 0) + 1; });
    return c;
  }, [leads]);

  const filtered = tab === "all" ? leads : leads.filter((l) => (l.status || "new") === tab);

  return (
    <div className="px-6 lg:px-14 py-10 max-w-full overflow-x-hidden" data-testid="demo-leads-page">
      <div className="eyebrow flex items-center gap-2"><Inbox size={12} /> DEMO / PILOT LEADS</div>
      <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
        Manage incoming <span className="text-[color:var(--brand-3)]">demo requests</span>
      </h1>
      <p className="text-[color:var(--ink-3)] text-sm mt-2">
        Every "Book a Demo" / contact form submission, stored in <span className="font-mono">contact_messages</span>. Triage without leaving the app.
      </p>

      <div className="flex flex-wrap gap-2 mt-6" data-testid="demo-leads-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            data-testid={`demo-leads-tab-${t}`}
            className={t === tab ? "gs-btn-primary" : "gs-btn-secondary"}
          >
            {t === "all" ? "All" : STATUS_META[t].label} · {counts[t] || 0}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-[color:var(--ink-3)] text-sm flex items-center gap-2 mt-8">
          <Loader2 className="animate-spin" size={14} /> Loading leads…
        </div>
      ) : filtered.length === 0 ? (
        <div className="gs-card p-10 mt-6 text-center text-sm text-[color:var(--ink-3)]" data-testid="demo-leads-empty">
          <Mail size={22} className="mx-auto mb-2 opacity-60" />
          No leads in this view yet.
        </div>
      ) : (
        <div className="gs-card p-5 mt-6 divide-y divide-[color:var(--line)]">
          {filtered.map((lead) => {
            const status = lead.status || "new";
            const meta = STATUS_META[status];
            return (
              <div key={lead.id} className="py-4 flex flex-col md:flex-row md:items-start gap-3 md:gap-6" data-testid={`demo-lead-row-${lead.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[color:var(--ink)]">{lead.name}</span>
                    <a href={`mailto:${lead.email}`} data-testid={`demo-lead-email-${lead.id}`} className="text-xs text-[color:var(--brand-3)] hover:underline">
                      {lead.email}
                    </a>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${meta.color}`} data-testid={`demo-lead-status-${lead.id}`}>
                      <meta.icon size={10} /> {meta.label.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-[color:var(--ink-2)] mt-2 whitespace-pre-wrap">{lead.message}</p>
                  <div className="text-[10px] font-mono text-[color:var(--ink-3)] mt-2">
                    {lead.created_at ? new Date(lead.created_at).toLocaleString() : ""}
                  </div>
                </div>
                <div className="flex md:flex-col gap-2 shrink-0">
                  {Object.keys(STATUS_META).filter((s) => s !== status).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(lead, s)}
                      disabled={busyId === lead.id}
                      data-testid={`demo-lead-mark-${s}-${lead.id}`}
                      className="text-[11px] font-mono px-2.5 py-1.5 rounded-full border border-[color:var(--line)] text-[color:var(--ink-2)] hover:border-[color:var(--brand)] hover:text-[color:var(--brand-3)] transition disabled:opacity-50"
                    >
                      Mark {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
