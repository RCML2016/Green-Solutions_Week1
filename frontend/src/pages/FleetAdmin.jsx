import { useCallback, useEffect, useState } from "react";
import { api, downloadAuthed, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Building2, Package, Upload, History, Plus, Pencil, ArchiveRestore, Trash2, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

const SITE_EMPTY = { site_id: "", site_name: "", site_type: "Utility-Scale Solar", site_capacity_kW: "", state: "", latitude: "", longitude: "", cod_date: "", owner_client: "" };
const ASSET_EMPTY = { asset_id: "", site_id: "", asset_type: "Inverter", make: "", model: "", serial_number: "", nameplate_kW: "", install_date: "", status: "Active" };
const tabs = [{ id: "sites", label: "Sites", icon: Building2 }, { id: "assets", label: "Assets", icon: Package }, { id: "import", label: "Import", icon: Upload }, { id: "audit", label: "Audit", icon: History }];

function Modal({ title, children, onClose }) {
  return <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onMouseDown={onClose}>
    <div className="gs-card w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-5"><h2 className="font-display text-xl">{title}</h2><button onClick={onClose}>✕</button></div>{children}
    </div>
  </div>;
}

function Field({ label, name, value, onChange, type = "text", disabled = false }) {
  return <label className="text-xs text-[color:var(--ink-2)]">{label}<input className="gs-input mt-1 w-full" name={name} type={type} value={value ?? ""} onChange={onChange} disabled={disabled} /></label>;
}

export default function FleetAdmin() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState("sites");
  const [sites, setSites] = useState([]); const [assets, setAssets] = useState([]); const [auditRows, setAuditRows] = useState([]);
  const [loading, setLoading] = useState(false); const [includeRetired, setIncludeRetired] = useState(false);
  const [editor, setEditor] = useState(null); const [form, setForm] = useState({});
  const [file, setFile] = useState(null); const [importType, setImportType] = useState("sites"); const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab !== "sites" && sites.length === 0) { const { data } = await api.get("/fleet/sites", { params: { limit: 500 } }); setSites(data.items); }
      if (tab === "sites") { const { data } = await api.get("/fleet/sites", { params: { limit: 500, include_retired: includeRetired } }); setSites(data.items); }
      if (tab === "assets") { const { data } = await api.get("/fleet-admin/assets", { params: { limit: 500, include_retired: includeRetired } }); setAssets(data.items); }
      if (tab === "audit" && isAdmin) { const { data } = await api.get("/fleet-admin/audit", { params: { limit: 200 } }); setAuditRows(data.items); }
    } catch (e) { toast.error(formatApiError(e)); } finally { setLoading(false); }
  }, [tab, includeRetired, isAdmin, sites.length]);
  useEffect(() => { load(); }, [load]);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const openCreate = (kind) => { setEditor({ kind, create: true }); const initial = kind === "site" ? SITE_EMPTY : { ...ASSET_EMPTY, site_id: sites[0]?.site_id || "" }; setForm(initial); };
  const openEdit = (kind, row) => { setEditor({ kind, create: false }); setForm({ ...row }); };
  const clean = (kind) => {
    const out = { ...form };
    ["created_by", "updated_by", "created_at", "updated_at", "retired_at", "retired_by", "lifecycle_status", "site_name"].forEach(k => delete out[k]);
    ["site_capacity_kW", "latitude", "longitude", "nameplate_kW"].forEach(k => { if (out[k] === "" || out[k] == null) delete out[k]; else out[k] = Number(out[k]); });
    if (editor.create) delete out.version;
    if (kind === "site" && !editor.create) delete out.site_id;
    if (kind === "asset" && !editor.create) delete out.asset_id;
    return out;
  };
  const save = async (e) => { e.preventDefault(); const { kind, create } = editor; const base = `/fleet-admin/${kind}s`; try {
    if (create) await api.post(base, clean(kind)); else await api.patch(`${base}/${form[`${kind}_id`]}`, clean(kind));
    toast.success(`${kind} ${create ? "created" : "updated"}`); setEditor(null); load();
  } catch (err) { toast.error(formatApiError(err)); } };
  const lifecycle = async (kind, row) => { const id = row[`${kind}_id`]; const retired = row.lifecycle_status === "retired"; if (!retired && !window.confirm(`Retire ${id}? Historical data will be retained.`)) return; try {
    if (retired) await api.post(`/fleet-admin/${kind}s/${id}/restore`); else await api.delete(`/fleet-admin/${kind}s/${id}`);
    toast.success(`${id} ${retired ? "restored" : "retired"}`); load();
  } catch (e) { toast.error(formatApiError(e)); } };
  const toggleFeatured = async (kind, row) => { const id = row[`${kind}_id`]; try {
    await api.post(`/fleet-admin/${kind}s/${id}/toggle-featured`);
    toast.success(`${id} ${row.featured_for_demo ? "removed from" : "added to"} demo portfolio`); load();
  } catch (e) { toast.error(formatApiError(e)); } };
  const runImport = async (commit) => { if (!file) return toast.error("Choose a CSV or XLSX file"); const body = new FormData(); body.append("file", file); try { const { data } = await api.post(`/fleet-admin/import/${importType}?commit=${commit}`, body); setPreview(data); if (data.committed) toast.success(`${data.committed} rows imported`); } catch (e) { toast.error(formatApiError(e)); } };

  return <div className="px-6 lg:px-14 py-10 max-w-full" data-testid="fleet-admin-page">
    <div className="eyebrow">FLEET ADMINISTRATION</div><h1 className="font-display text-3xl mt-3">Site & asset lifecycle</h1>
    <p className="text-sm text-[color:var(--ink-3)] mt-2">Create, maintain, safely retire and restore fleet master data.</p>
    <div className="flex flex-wrap gap-2 mt-6">{tabs.filter(t => t.id !== "audit" || isAdmin).map(t => <button key={t.id} onClick={() => setTab(t.id)} className={tab === t.id ? "gs-btn-primary" : "gs-btn-secondary"}><t.icon size={15}/>{t.label}</button>)}</div>
    {(tab === "sites" || tab === "assets") && <div className="flex justify-between items-center mt-6">
      <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={includeRetired} onChange={e => setIncludeRetired(e.target.checked)}/> Show retired</label>
      <button className="gs-btn-primary" onClick={() => openCreate(tab === "sites" ? "site" : "asset")}><Plus size={15}/> New {tab === "sites" ? "Site" : "Asset"}</button>
    </div>}
    {loading && <div className="py-16 flex justify-center"><Loader2 className="animate-spin"/></div>}
    {!loading && tab === "sites" && <Table headers={["SITE", "TYPE", "STATE", "CAPACITY", "STATUS", "ACTIONS"]}>{sites.map(s => <tr key={s.site_id} className="border-b border-[color:var(--line-2)]"><Cell mono>{s.site_id}<div className="text-[color:var(--ink)]">{s.site_name}</div></Cell><Cell>{s.site_type}</Cell><Cell>{s.state}</Cell><Cell>{Number(s.site_capacity_kW || 0).toLocaleString()} kW</Cell><Cell>{s.lifecycle_status || "active"}</Cell><Actions onEdit={() => openEdit("site", s)} onLife={() => lifecycle("site", s)} onFeatured={() => toggleFeatured("site", s)} featured={s.featured_for_demo} retired={s.lifecycle_status === "retired"} isAdmin={isAdmin}/></tr>)}</Table>}
    {!loading && tab === "assets" && <Table headers={["ASSET", "TYPE", "SITE", "MAKE / MODEL", "STATUS", "ACTIONS"]}>{assets.map(a => <tr key={a.asset_id} className="border-b border-[color:var(--line-2)]"><Cell mono>{a.asset_id}</Cell><Cell>{a.asset_type}</Cell><Cell>{a.site_id}<div>{a.site_name}</div></Cell><Cell>{a.make} {a.model}</Cell><Cell>{a.lifecycle_status || "active"}</Cell><Actions onEdit={() => openEdit("asset", a)} onLife={() => lifecycle("asset", a)} onFeatured={() => toggleFeatured("asset", a)} featured={a.featured_for_demo} retired={a.lifecycle_status === "retired"} isAdmin={isAdmin}/></tr>)}</Table>}
    {tab === "import" && <div className="gs-card p-6 mt-6 max-w-2xl"><h2 className="font-display text-xl">Validated bulk import</h2><p className="text-xs text-[color:var(--ink-3)] mt-2">Preview validates every row and makes no changes. Commit is enabled only after a clean preview.</p><div className="grid md:grid-cols-2 gap-4 mt-5"><label className="text-xs">Data type<select className="gs-input mt-1 w-full" value={importType} onChange={e => {setImportType(e.target.value);setPreview(null)}}><option value="sites">Sites</option><option value="assets">Assets</option></select></label><label className="text-xs">CSV or XLSX<input className="gs-input mt-1 w-full" type="file" accept=".csv,.xlsx" onChange={e => {setFile(e.target.files[0]);setPreview(null)}}/></label></div><div className="flex gap-2 mt-5"><button className="gs-btn-secondary" onClick={() => runImport(false)}>Validate / dry-run</button><button className="gs-btn-primary" disabled={!preview || preview.errors?.length || !preview.valid} onClick={() => runImport(true)}>Commit import</button></div>{preview && <pre className="mt-5 text-xs bg-[color:var(--bg-2)] p-4 rounded-xl overflow-auto">{JSON.stringify(preview, null, 2)}</pre>}</div>}
    {!loading && tab === "audit" && <><div className="flex justify-end mt-5"><button className="gs-btn-secondary" onClick={() => downloadAuthed("/fleet-admin/audit-export", "fleet-audit-log.csv")}>Export CSV</button></div><Table headers={["TIME", "ACTOR", "ACTION", "ENTITY", "ID"]}>{auditRows.map((x,i) => <tr key={i} className="border-b border-[color:var(--line-2)]"><Cell>{new Date(x.timestamp).toLocaleString()}</Cell><Cell>{x.actor?.email}</Cell><Cell>{x.action}</Cell><Cell>{x.entity_type}</Cell><Cell mono>{x.entity_id}</Cell></tr>)}</Table></>}
    {editor && <Modal title={`${editor.create ? "New" : "Edit"} ${editor.kind}`} onClose={() => setEditor(null)}><form onSubmit={save}><div className="grid md:grid-cols-2 gap-4">{editor.kind === "site" ? <><Field label="Site ID" name="site_id" value={form.site_id} onChange={change} disabled={!editor.create}/><Field label="Name" name="site_name" value={form.site_name} onChange={change}/><Field label="Category" name="site_type" value={form.site_type} onChange={change}/><Field label="Capacity (kW)" name="site_capacity_kW" type="number" value={form.site_capacity_kW} onChange={change}/><Field label="State" name="state" value={form.state} onChange={change}/><Field label="COD date" name="cod_date" type="date" value={form.cod_date} onChange={change}/><Field label="Latitude" name="latitude" type="number" value={form.latitude} onChange={change}/><Field label="Longitude" name="longitude" type="number" value={form.longitude} onChange={change}/><Field label="Owner / client" name="owner_client" value={form.owner_client} onChange={change}/></> : <><Field label="Asset ID" name="asset_id" value={form.asset_id} onChange={change} disabled={!editor.create}/><label className="text-xs">Site<select className="gs-input mt-1 w-full" name="site_id" value={form.site_id} onChange={change}>{sites.map(s=><option key={s.site_id} value={s.site_id}>{s.site_id} · {s.site_name}</option>)}</select></label><Field label="Type" name="asset_type" value={form.asset_type} onChange={change}/><Field label="Make" name="make" value={form.make} onChange={change}/><Field label="Model" name="model" value={form.model} onChange={change}/><Field label="Serial number" name="serial_number" value={form.serial_number} onChange={change}/><Field label="Nameplate (kW)" name="nameplate_kW" type="number" value={form.nameplate_kW} onChange={change}/><Field label="Install date" name="install_date" type="date" value={form.install_date} onChange={change}/></>}</div><div className="flex justify-end gap-2 mt-6"><button type="button" className="gs-btn-secondary" onClick={() => setEditor(null)}>Cancel</button><button className="gs-btn-primary">Save</button></div></form></Modal>}
  </div>;
}

function Table({ headers, children }) { return <div className="gs-card p-5 mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-[10px] font-mono text-[color:var(--ink-3)] border-b border-[color:var(--line-2)]">{headers.map(h=><th key={h} className="text-left p-2">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Cell({ children, mono }) { return <td className={`p-2 text-xs ${mono ? "font-mono text-[color:var(--brand-3)]" : "text-[color:var(--ink-2)]"}`}>{children}</td>; }
function Actions({ onEdit, onLife, onFeatured, featured, retired, isAdmin }) { return <td className="p-2"><div className="flex gap-2"><button title="Edit" data-testid="fleet-admin-edit-btn" onClick={onEdit}><Pencil size={15}/></button>{isAdmin && <button title={featured ? "Remove from demo portfolio" : "Feature in demo portfolio"} data-testid="fleet-admin-featured-btn" onClick={onFeatured}><Star size={15} className={featured ? "fill-amber-400 text-amber-500" : "text-[color:var(--ink-3)]"}/></button>}{isAdmin && <button title={retired ? "Restore" : "Retire"} data-testid="fleet-admin-lifecycle-btn" onClick={onLife}>{retired ? <ArchiveRestore size={15}/> : <Trash2 size={15}/>}</button>}</div></td>; }
