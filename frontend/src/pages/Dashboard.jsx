import { useEffect, useState, useRef } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Download, Loader2, Share2, Copy, X } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import CategorySwitcher from "@/components/dashboard/CategorySwitcher";
import FleetKpiCards from "@/components/dashboard/FleetKpiCards";
import SitesTable from "@/components/dashboard/SitesTable";
import AlarmsFeed from "@/components/dashboard/AlarmsFeed";
import WorkOrdersCard from "@/components/dashboard/WorkOrdersCard";
import AiInsightPanel from "@/components/dashboard/AiInsightPanel";
import OnboardingTour from "@/components/OnboardingTour";

const REFRESH_MS = 5000;

export default function Dashboard() {
  const { user } = useAuth();
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [pulse, setPulse] = useState(false);
  const captureRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  // Share snapshot
  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const aiPanelRef = useRef(null);

  // Load categories once
  useEffect(() => {
    api.get("/fleet/categories")
      .then(({ data }) => setCategories(data))
      .catch(() => setCategories([]));
  }, []);

  // Poll KPIs by category — 5s (simulated live via telemetry sliding window)
  useEffect(() => {
    let mounted = true;
    let timer = null;
    const fetchOnce = async () => {
      try {
        const { data } = await api.get("/fleet/kpis", { params: category ? { category } : {} });
        if (!mounted) return;
        setKpis(data);
        setPulse(true);
        setTimeout(() => mounted && setPulse(false), 700);
      } catch (e) {
        console.warn("KPI poll failed:", e?.message);
      }
    };
    fetchOnce();
    timer = setInterval(fetchOnce, REFRESH_MS);
    return () => { mounted = false; clearInterval(timer); };
  }, [category]);

  // "Findings" fed into AI panel — synthesised from real alarm root causes
  const [findings, setFindings] = useState([]);
  useEffect(() => {
    api.get("/fleet/alarms", { params: { severity: "High", limit: 6 } })
      .then(({ data }) => {
        const derived = data.items.slice(0, 4).map((a) => ({
          code: a.alarm_id.replace("AL", "AL-"),
          title: `${a.root_cause_category} @ ${a.site_id}`,
          severity: "high",
          confidence: Math.min(99, Math.max(60, Math.round(100 - (a.duration_hours || 0) * 1.2))),
        }));
        setFindings(derived);
      })
      .catch(() => setFindings([]));
  }, []);

  const share = async () => {
    setSharing(true);
    try {
      const { data } = await api.post("/snapshots", {});
      setShareLink(data.url);
      try { await navigator.clipboard.writeText(data.url); toast.success("Snapshot link copied"); } catch { toast.success("Snapshot ready"); }
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSharing(false); }
  };

  const exportPdf = async () => {
    if (!captureRef.current) return;
    setExporting(true);
    try {
      let branding = { company_name: "", cover_note: "", logo_data_url: "" };
      try { branding = (await api.get("/reports/branding")).data; }
      catch (e) { console.warn("Branding fetch failed:", e?.message); }

      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
        scale: 2, useCORS: true,
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const hasBranding = branding.company_name || branding.cover_note || branding.logo_data_url;
      if (hasBranding) {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageW, pageH, "F");
        pdf.setFillColor(24, 168, 102);
        pdf.rect(0, 0, pageW, 8, "F");
        if (branding.logo_data_url) {
          try { pdf.addImage(branding.logo_data_url, "PNG", 40, 60, 120, 60, undefined, "FAST"); }
          catch (e) { console.warn("Logo embed failed:", e?.message); }
        }
        pdf.setTextColor(7, 28, 20);
        pdf.setFontSize(28);
        pdf.text(branding.company_name || "Portfolio Report", 40, 180);
        pdf.setFontSize(11);
        pdf.setTextColor(104, 120, 112);
        const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
        pdf.text(`Green Solutions · ${dateStr}`, 40, 200);
        if (branding.cover_note) {
          const lines = pdf.splitTextToSize(branding.cover_note, pageW - 80);
          pdf.setFontSize(12);
          pdf.setTextColor(7, 28, 20);
          pdf.text(lines, 40, 250);
        }
        pdf.addPage();
      }

      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageW, pageH, "F");
      const imgH = (canvas.height * pageW) / canvas.width;
      pdf.addImage(img, "PNG", 0, 0, pageW, imgH);

      const fname = `${(branding.company_name || "green-solutions").toLowerCase().replace(/\s+/g, "-")}-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fname);
      toast.success("Report exported");
    } catch { toast.error("Export failed"); }
    finally { setExporting(false); }
  };

  return (
    <div className="px-6 lg:px-14 py-10 min-h-[80vh] max-w-full overflow-x-hidden" data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span className={`pulse-dot ${pulse ? "opacity-100" : "opacity-90"}`} /> LIVE INTELLIGENCE · POLL {REFRESH_MS / 1000}s
          </div>
          <h1 className="font-display text-3xl md:text-4xl mt-3 text-[color:var(--ink)]">
            Welcome, <span className="text-[color:var(--brand-3)]">{user?.name?.split(" ")[0] || "Operator"}</span>.
          </h1>
          <p className="text-[color:var(--ink-3)] text-sm mt-2">
            {kpis ? `${kpis.site_count} sites · ${kpis.asset_count.toLocaleString()} assets · ${kpis.total_capacity_MW.toFixed(2)} MW under intelligence.` : "Streaming fleet intelligence…"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={share}
            disabled={sharing || !kpis}
            data-testid="share-snapshot-btn"
            className="rounded-full px-4 py-2.5 text-sm border border-[color:var(--line)] bg-[color:var(--bg-2)] text-[color:var(--ink-2)] hover:border-[color:var(--brand)] hover:text-[color:var(--brand-3)] flex items-center gap-2 transition disabled:opacity-60"
          >
            {sharing ? <Loader2 className="animate-spin" size={14} /> : <Share2 size={14} />}
            {sharing ? "Sharing..." : "Share"}
          </button>
          <button
            onClick={exportPdf}
            disabled={exporting || !kpis}
            data-testid="export-pdf-btn"
            className="gs-btn-primary text-sm disabled:opacity-60"
          >
            {exporting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
            {exporting ? "Exporting..." : "Export Report"}
          </button>
        </div>
      </div>

      {shareLink && (
        <div className="gs-card p-3 mb-6 flex items-center gap-3" data-testid="share-link-card">
          <Share2 size={14} className="text-[color:var(--brand-3)]" />
          <span className="text-[10px] font-mono text-[color:var(--ink-3)]">READ-ONLY LINK · EXPIRES IN 14D</span>
          <code className="text-xs text-[color:var(--ink)] truncate flex-1">{shareLink}</code>
          <button
            onClick={async () => {
              try { await navigator.clipboard.writeText(shareLink); toast.success("Copied"); }
              catch (e) { console.warn("Clipboard write failed:", e?.message); toast.error("Copy failed"); }
            }}
            className="p-1.5 rounded-lg hover:bg-[color:var(--brand-tint)] text-[color:var(--ink-3)] hover:text-[color:var(--brand-3)]"
            data-testid="share-copy"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => setShareLink("")}
            className="p-1.5 rounded-lg hover:bg-[color:var(--bg-3)] text-[color:var(--ink-3)]"
            data-testid="share-close"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {categories.length > 0 && (
        <div className="mb-6">
          <CategorySwitcher categories={categories} active={category} onChange={setCategory} />
        </div>
      )}

      {!kpis ? (
        <div className="text-[color:var(--ink-3)] text-sm flex items-center gap-2">
          <Loader2 className="animate-spin" size={14} /> Loading fleet intelligence...
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <div ref={captureRef} className="space-y-6">
            <FleetKpiCards kpis={kpis} pulse={pulse} />

            <div className="grid lg:grid-cols-2 gap-6">
              <SitesTable category={category} />
              <div className="space-y-6">
                <AlarmsFeed category={category} />
                <WorkOrdersCard category={category} />
              </div>
            </div>
          </div>

          <AiInsightPanel ref={aiPanelRef} findings={findings} />
        </div>
      )}

      {kpis && <OnboardingTour />}
    </div>
  );
}
