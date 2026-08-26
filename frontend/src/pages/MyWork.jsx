import { useEffect, useState, useRef } from "react";
import { api, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import {
  ClipboardList, AlertTriangle, Wrench, ArrowRight, Loader2, CheckCircle2,
  Camera, Upload, X, Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

const CHECKLIST_ITEMS = [
  "Isolate & lock out the affected asset",
  "Inspect for physical damage / thermal signs",
  "Verify communication with SCADA",
  "Confirm reset and re-enter service",
];

/**
 * My Work — Field Technician workspace, mobile-first.
 * Cards use large tap targets, bottom sheet for the diagnose flow, and
 * a camera evidence uploader tied to Emergent Object Storage.
 */
export default function MyWork() {
  const { user } = useAuth();
  const [alarms, setAlarms] = useState([]);
  const [wos, setWos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // alarm currently in diagnose flow
  const [checklist, setChecklist] = useState({});
  const [evidence, setEvidence] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
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

  const openDiagnose = async (a) => {
    setSelected(a);
    setChecklist({});
    // load prior evidence attached to this alarm
    try {
      const { data } = await api.get("/evidence", { params: { alarm_id: a.alarm_id } });
      setEvidence(data);
    } catch (e) {
      console.warn("Evidence fetch failed:", e?.message);
      setEvidence([]);
    }
  };

  const uploadEvidence = async (files) => {
    if (!files || files.length === 0 || !selected) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("alarm_id", selected.alarm_id);
        fd.append("site_id", selected.site_id);
        fd.append("note", `Uploaded from My Work by ${user?.name || user?.email}`);
        const { data } = await api.post("/evidence", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setEvidence((cur) => [data, ...cur]);
      }
      toast.success("Evidence uploaded");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const complete = async () => {
    if (!selected) return;
    try {
      await api.post("/alerts", {
        code: selected.alarm_id,
        title: selected.root_cause_category,
        severity: selected.severity.toLowerCase(),
        confidence: 92,
      });
      await api.post("/actions", {
        finding_code: selected.alarm_id,
        finding_title: selected.root_cause_category,
        action_text: `Field-resolved by ${user?.name} · ${Object.values(checklist).filter(Boolean).length}/${CHECKLIST_ITEMS.length} steps · ${evidence.length} photos`,
      });
      toast.success("Marked resolved");
      setAlarms((list) => list.filter((x) => x.alarm_id !== selected.alarm_id));
      setSelected(null);
      setEvidence([]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not save");
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
    <div className="px-4 md:px-6 lg:px-14 py-6 md:py-10 max-w-full overflow-x-hidden pb-24 md:pb-10" data-testid="my-work-page">
      <div className="eyebrow flex items-center gap-2">
        <ClipboardList size={12} /> MY WORK
      </div>
      <h1 className="font-display text-2xl md:text-4xl mt-3 text-[color:var(--ink)]">
        {alarms.length + wos.length} items <span className="text-[color:var(--brand-3)]">for you</span>
      </h1>
      <p className="text-[color:var(--ink-3)] text-sm mt-2">
        Tap any card to diagnose, upload photos, and mark resolved.
      </p>

      {/* Assigned alarms */}
      <div className="mt-6">
        <div className="font-mono text-[10px] text-[color:var(--ink-3)] mb-3">HIGH-SEVERITY ALARMS · {alarms.length}</div>
        {alarms.length === 0 ? (
          <div className="gs-card p-6 text-center text-[color:var(--ink-3)] text-sm">
            <CheckCircle2 size={20} className="mx-auto text-[color:var(--brand-3)] mb-2" />
            All clear.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {alarms.map((a) => (
              <button
                key={a.alarm_id}
                onClick={() => openDiagnose(a)}
                data-testid={`mywork-alarm-${a.alarm_id}`}
                className="gs-card p-4 md:p-5 text-left active:scale-[0.99] transition"
              >
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
                  <ArrowRight size={16} className="text-[color:var(--ink-3)] mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dispatched WOs */}
      <div className="mt-8">
        <div className="font-mono text-[10px] text-[color:var(--ink-3)] mb-3">DISPATCHED WORK ORDERS · {wos.length}</div>
        {wos.length === 0 ? (
          <div className="gs-card p-6 text-center text-[color:var(--ink-3)] text-sm">
            No dispatched work orders.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {wos.map((wo) => (
              <Link
                key={wo.work_order_id}
                to={`/site/${wo.site_id}`}
                data-testid={`mywork-wo-${wo.work_order_id}`}
                className="gs-card p-4 md:p-5 active:scale-[0.99] transition"
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

      {/* Bottom sheet: Diagnose flow */}
      {selected && (
        <DiagnoseSheet
          alarm={selected}
          onClose={() => { setSelected(null); setEvidence([]); }}
          checklist={checklist}
          setChecklist={setChecklist}
          evidence={evidence}
          uploading={uploading}
          fileInputRef={fileInputRef}
          onFiles={(files) => uploadEvidence(files)}
          onComplete={complete}
        />
      )}
    </div>
  );
}

function DiagnoseSheet({ alarm, onClose, checklist, setChecklist, evidence, uploading, fileInputRef, onFiles, onComplete }) {
  const done = Object.values(checklist).filter(Boolean).length;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-6" data-testid="diagnose-sheet">
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-lg max-h-[92vh] flex flex-col shadow-2xl">
        <div className="p-5 border-b border-[color:var(--line-2)] flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[#fee2e2] text-[#b91c1c]">
            <AlertTriangle size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[11px] text-[color:var(--brand-3)]">{alarm.alarm_id} · {alarm.severity.toUpperCase()}</div>
            <div className="text-sm text-[color:var(--ink)] mt-0.5">{alarm.root_cause_category}</div>
            <div className="text-[10px] font-mono text-[color:var(--ink-3)] mt-0.5">
              {alarm.site_id} · {alarm.asset_id} · {alarm.duration_hours}h open
            </div>
          </div>
          <button onClick={onClose} data-testid="diagnose-close" className="p-2 rounded-lg hover:bg-[color:var(--bg-3)] text-[color:var(--ink-3)]">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* Checklist */}
          <div>
            <div className="font-mono text-[10px] text-[color:var(--ink-3)] mb-2">
              CHECKLIST · {done}/{CHECKLIST_ITEMS.length}
            </div>
            <div className="space-y-2">
              {CHECKLIST_ITEMS.map((item, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-3 rounded-xl p-3 border cursor-pointer transition ${
                    checklist[i]
                      ? "border-[color:var(--brand)] bg-[color:var(--brand-tint)]"
                      : "border-[color:var(--line-2)] bg-white"
                  }`}
                  data-testid={`checklist-${i}`}
                >
                  <input
                    type="checkbox"
                    checked={!!checklist[i]}
                    onChange={(e) => setChecklist((c) => ({ ...c, [i]: e.target.checked }))}
                    className="mt-0.5 accent-[color:var(--brand)]"
                  />
                  <span className="text-sm text-[color:var(--ink)]">{item}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Evidence */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="font-mono text-[10px] text-[color:var(--ink-3)]">
                EVIDENCE · {evidence.length}
              </div>
              <label
                data-testid="evidence-upload-btn"
                className="cursor-pointer inline-flex items-center gap-1.5 text-[11px] font-mono text-[color:var(--brand-3)] hover:text-[color:var(--brand)]"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                {uploading ? "UPLOADING..." : "ADD PHOTO"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => onFiles(Array.from(e.target.files || []))}
                  data-testid="evidence-file-input"
                />
              </label>
            </div>
            {evidence.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[color:var(--line)] p-6 text-center text-[color:var(--ink-3)] text-xs">
                <ImageIcon size={18} className="mx-auto mb-2 text-[color:var(--ink-3)]" />
                No photos attached yet. Tap "Add Photo" to capture.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {evidence.map((ev) => (
                  <EvidenceThumb key={ev.id} ev={ev} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[color:var(--line-2)] flex gap-2 sticky bottom-0 bg-white">
          <Link
            to={`/site/${alarm.site_id}`}
            className="flex-1 text-center px-4 py-3 rounded-full border border-[color:var(--line)] text-sm text-[color:var(--ink-2)] hover:border-[color:var(--brand)]"
            data-testid="diagnose-open-site"
          >
            Open Site
          </Link>
          <button
            onClick={onComplete}
            data-testid="diagnose-complete"
            className="flex-1 gs-btn-primary justify-center text-sm"
          >
            <CheckCircle2 size={14} /> Mark Resolved
          </button>
        </div>
      </div>
    </div>
  );
}

/** Fetches evidence bytes as a blob so we don't leak the JWT into the DOM. */
function EvidenceThumb({ ev }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let objectUrl = null;
    let mounted = true;
    const token = localStorage.getItem("gs_token");
    fetch(`${API}/evidence/${ev.id}/file`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((b) => {
        if (!mounted) return;
        objectUrl = URL.createObjectURL(b);
        setSrc(objectUrl);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ev.id]);

  return (
    <div className="aspect-square rounded-lg overflow-hidden bg-[color:var(--bg-3)] border border-[color:var(--line-2)]" data-testid={`evidence-thumb-${ev.id}`}>
      {src ? (
        <img src={src} alt="Evidence" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[color:var(--ink-3)]">
          <ImageIcon size={16} />
        </div>
      )}
    </div>
  );
}
