import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Database, Download, Loader2, Play, RefreshCw, Upload } from "lucide-react";
import { api, downloadAuthed, formatApiError } from "@/lib/api";
import { toast } from "sonner";

const statusClass = {
  healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  degraded: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

export default function IntegrationHealth() {
  const [health, setHealth] = useState(null);
  const [mapping, setMapping] = useState(null);
  const [dlq, setDlq] = useState([]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    const [healthResult, mappingResult, dlqResult] = await Promise.all([
      api.get("/integrations/health"),
      api.get("/integrations/solar-scada-pilot/mapping").catch(() => ({ data: null })),
      api.get("/integrations/dlq?status=pending&limit=50"),
    ]);
    setHealth(healthResult.data);
    setMapping(mappingResult.data);
    setDlq(dlqResult.data.items || []);
  }, []);

  useEffect(() => {
    load().catch((error) => toast.error(formatApiError(error)));
  }, [load]);

  const bootstrap = async () => {
    setBusy(true);
    try {
      const response = await api.post("/integrations/solar-scada-pilot/bootstrap-demo");
      setMapping(response.data.mapping);
      toast.success(`Pilot mapped to ${response.data.site.site_id} / ${response.data.asset.asset_id}`);
      await load();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (dryRun) => {
    if (!file) return toast.error("Choose a Solar SCADA CSV file first.");
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await api.post(`/integrations/solar-scada-pilot/upload?dry_run=${dryRun}`, body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(response.data);
      toast.success(dryRun ? "Validation completed" : "Pilot data ingested");
      await load();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setBusy(false);
    }
  };

  const replay = async (id) => {
    setBusy(true);
    try {
      await api.post(`/integrations/dlq/${id}/replay`);
      toast.success("DLQ record replayed");
      await load();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setBusy(false);
    }
  };

  const summary = health?.summary || {};
  const cards = [
    ["Configured", summary.configured || 0, Database],
    ["Healthy", summary.healthy || 0, CheckCircle2],
    ["Degraded", summary.degraded || 0, AlertTriangle],
    ["DLQ Pending", summary.dlq_pending || 0, Activity],
  ];

  return (
    <div className="px-6 lg:px-14 py-10 max-w-full" data-testid="integration-health-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow flex items-center gap-2"><Activity size={12} /> INTEGRATION HEALTH</div>
          <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
            Solar SCADA <span className="text-[color:var(--brand-3)]">pilot connector</span>
          </h1>
          <p className="text-[color:var(--ink-3)] text-sm mt-2 max-w-3xl">
            Validate, map and ingest customer SCADA CSV data into AssetNova with idempotency, canonical storage and DLQ handling.
          </p>
        </div>
        <button className="gs-btn-secondary" onClick={() => load()} disabled={busy}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {cards.map(([label, value, Icon]) => (
          <div className="gs-card p-5" key={label}>
            <div className="text-[10px] font-mono text-[color:var(--ink-3)] flex justify-between">{label.toUpperCase()} <Icon size={13} /></div>
            <div className="font-display text-3xl mt-2 text-[color:var(--ink)]">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-2 gap-6 mt-8">
        <section className="gs-card p-6" data-testid="scada-pilot-setup">
          <div className="font-mono text-[10px] text-[color:var(--ink-3)]">PILOT SETUP</div>
          <h2 className="font-display text-xl mt-2 text-[color:var(--ink)]">Customer CSV ingestion</h2>
          {!mapping ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Configure a demo mapping to one existing Solar site and asset before uploading data.
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Mapping ready · {Object.keys(mapping.assets || {}).length} device · {Object.keys(mapping.tags || {}).length} tags · {mapping.mode}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            <button className="gs-btn-secondary" onClick={bootstrap} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />} Configure Demo Mapping
            </button>
            <button className="gs-btn-secondary" disabled={!mapping || busy} onClick={() => downloadAuthed("/integrations/solar-scada-pilot/sample", "pilot_scada_sample.csv").catch((e) => toast.error(formatApiError(e)))}>
              <Download size={14} /> Download Sample CSV
            </button>
          </div>
          <label className="block mt-6 text-xs font-mono text-[color:var(--ink-3)]">CUSTOMER SCADA CSV</label>
          <input className="gs-input mt-2 w-full" type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <div className="flex flex-wrap gap-2 mt-4">
            <button className="gs-btn-secondary" onClick={() => upload(true)} disabled={!mapping || busy || !file}><Play size={14} /> Validate Only</button>
            <button className="gs-btn-primary" onClick={() => upload(false)} disabled={!mapping || busy || !file}><Upload size={14} /> Ingest Pilot Data</button>
          </div>
          {result && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 text-center">
              {["total", "accepted", "duplicates", "rejected"].map((key) => (
                <div className="rounded-xl border border-[color:var(--line)] p-3" key={key}>
                  <div className="font-display text-xl">{result[key]}</div><div className="text-[10px] font-mono text-[color:var(--ink-3)]">{key.toUpperCase()}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="gs-card p-6" data-testid="connector-status">
          <div className="font-mono text-[10px] text-[color:var(--ink-3)]">CONNECTOR STATUS</div>
          {(health?.connectors || []).length === 0 ? (
            <div className="text-sm text-[color:var(--ink-3)] mt-6">No ingestion run has completed yet.</div>
          ) : health.connectors.map((connector) => (
            <div className="mt-5 border border-[color:var(--line)] rounded-xl p-4" key={connector.connector_id}>
              <div className="flex items-center justify-between gap-4">
                <div><div className="font-medium">{connector.name}</div><div className="text-xs text-[color:var(--ink-3)] mt-1">{connector.protocol} · {connector.last_sync_at ? new Date(connector.last_sync_at).toLocaleString() : "Never"}</div></div>
                <span className={`border rounded-full px-3 py-1 text-[10px] font-mono ${statusClass[connector.status] || ""}`}>{connector.status?.toUpperCase()}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                <div>Processed <strong>{connector.records_processed || 0}</strong></div><div>Duplicates <strong>{connector.duplicates || 0}</strong></div>
                <div>Validation failures <strong>{connector.validation_failures || 0}</strong></div><div>Mapping <strong>{connector.mapping_coverage_pct || 0}%</strong></div>
              </div>
            </div>
          ))}
        </section>
      </div>

      <section className="gs-card p-6 mt-8" data-testid="integration-dlq">
        <div className="font-mono text-[10px] text-[color:var(--ink-3)]">DEAD-LETTER QUEUE</div>
        <h2 className="font-display text-xl mt-2">Records requiring mapping or data correction</h2>
        {dlq.length === 0 ? <div className="text-sm text-[color:var(--ink-3)] mt-5">No pending DLQ records.</div> : (
          <div className="overflow-x-auto mt-5"><table className="w-full text-sm"><thead><tr className="text-[10px] font-mono text-[color:var(--ink-3)] border-b border-[color:var(--line)]"><th className="text-left py-2">ROW</th><th className="text-left py-2">REASON</th><th className="text-left py-2">FAILED</th><th className="text-right py-2">ACTION</th></tr></thead>
          <tbody>{dlq.map((item) => <tr className="border-b border-[color:var(--line-2)]" key={item.id}><td className="py-3">{item.raw_payload?._row_number}</td><td className="py-3 pr-4">{item.reason}</td><td className="py-3 whitespace-nowrap">{new Date(item.failed_at).toLocaleString()}</td><td className="py-3 text-right"><button className="gs-btn-secondary" disabled={busy} onClick={() => replay(item.id)}><RefreshCw size={13} /> Replay</button></td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  );
}

