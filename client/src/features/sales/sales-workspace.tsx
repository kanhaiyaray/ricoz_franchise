"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, CalendarClock, CircleAlert, FilePlus2, LoaderCircle, Plus, RefreshCw, Search, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAppSelector } from "@/redux/hooks";
import { SalesService } from "@/services/sales.service";
import type { SalesLead, SalesLeadInput, SalesPipeline, SalesTask } from "@/services/types/sales.types";
import styles from "@/features/finance/finance-workspace.module.css";

export type SalesView =
  | "dashboard"
  | "calendar"
  | "work"
  | "approvals"
  | "crm"
  | "lead-source"
  | "follow-ups"
  | "assistant"
  | "customers"
  | "reports"
  | "integrations";

const titles: Record<SalesView, { title: string; description: string }> = {
  dashboard: { title: "Sales Dashboard", description: "Live pipeline, follow-ups and team work in your accessible scope." },
  calendar: { title: "Sales Calendar", description: "Upcoming activities and follow-ups recorded against leads." },
  work: { title: "My Work", description: "Tasks and accountability items assigned to you." },
  approvals: { title: "Approvals", description: "Review submitted work reports and team accountability." },
  crm: { title: "CRM & Leads", description: "Manage leads, ownership, pipeline stages and customer activity." },
  "lead-source": { title: "Client Lists / Lead Source", description: "Browse clients and imported leads by their recorded source." },
  "follow-ups": { title: "Follow-ups", description: "Work through scheduled sales activities and mark completed follow-ups." },
  assistant: { title: "Sales AI Assistant", description: "Assistant chat requires a configured provider." },
  customers: { title: "Customers", description: "Customers converted from your sales pipeline." },
  reports: { title: "Sales Reports", description: "Aggregates calculated from leads and tasks in your scope." },
  integrations: { title: "Sales Integrations", description: "Messaging features require configured provider credentials." },
};

type SalesWorkspaceProps = {
  view: SalesView;
  initialQuery: string;
  initialStatus: string;
  initialPage: number;
};

function objectOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function listOf<T>(value: unknown): T[] {
  const record = objectOf(value);
  return Array.isArray(record?.items) ? record.items as T[] : [];
}
function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Sales request failed.";
}
function Status({ value }: { value: string }) {
  const safe = value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return <span className={`${styles.statusBadge} ${styles[`status_${safe}`] ?? ""}`}>{value.replaceAll("_", " ") || "unknown"}</span>;
}

export default function SalesWorkspace({ view, initialQuery, initialStatus, initialPage }: SalesWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAppSelector((state) => state.auth.user);
  const admin = user?.user_role === "admin";
  const [franchiseId, setFranchiseId] = useState("");
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(initialPage);
  const [refreshToken, setRefreshToken] = useState(0);
  const [data, setData] = useState<unknown>(null);
  const [pipelines, setPipelines] = useState<SalesPipeline[]>([]);
  const [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const [selectedLead, setSelectedLead] = useState<SalesLead | null>(null);
  const [creatingLead, setCreatingLead] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const loadKey = [view, query, status, page, refreshToken, franchiseId].join(":");

  useEffect(() => {
    const updateScope = () => setFranchiseId(window.localStorage.getItem("dashboard-franchise-scope") ?? "");
    updateScope();
    window.addEventListener("dashboard-scope-change", updateScope);
    return () => window.removeEventListener("dashboard-scope-change", updateScope);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        let result: unknown;
        if (view === "dashboard") result = await SalesService.dashboard();
        else if (["crm", "customers", "lead-source"].includes(view)) {
          const params: Record<string, string | number | undefined> = {
            q: query || undefined,
            status: status || (view === "customers" ? "won" : undefined),
            page,
            limit: view === "crm" ? 100 : 20,
          };
          result = view === "lead-source" ? await SalesService.imported(params) : await SalesService.leads(params);
          if (view === "crm") {
            const pipelineResult = await SalesService.pipelines();
            if (active) setPipelines(pipelineResult.items);
          }
        } else if (view === "calendar" || view === "follow-ups") {
          const [leads, pipelineResult] = await Promise.all([
            SalesService.leads({ page: 1, limit: 100 }),
            SalesService.pipelines().catch(() => ({ items: [] as SalesPipeline[] })),
          ]);
          result = leads;
          if (active) setPipelines(pipelineResult.items);
        } else if (view === "work" || view === "approvals") {
          result = await SalesService.accountabilityTasks({ page, limit: 20, status: view === "approvals" ? "pending" : status || undefined });
        } else if (view === "reports") result = await SalesService.reports();
        else if (view === "assistant") result = await SalesService.assistantOverview();
        else if (view === "integrations") {
          result = await Promise.allSettled([
            SalesService.integration("/sales/leads/imported/whatsapp-accounts"),
            SalesService.integration("/sales/leads/imported/whatsapp-templates"),
            SalesService.integration("/sales/leads/imported/campaigns"),
          ]);
        }
        if (active) { setData(result ?? null); setError(""); setLoadedKey(loadKey); }
      } catch (caughtError) {
        if (active) { setError(messageOf(caughtError)); setLoadedKey(loadKey); }
      }
    }
    void load();
    return () => { active = false; };
  }, [franchiseId, loadKey, page, query, refreshToken, status, view]);

  function updateUrl(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value); else params.delete(key);
    }
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }
  function updateQuery(value: string) { setQuery(value); setPage(1); updateUrl({ q: value || undefined, page: undefined }); }
  function updateStatus(value: string) { setStatus(value); setPage(1); updateUrl({ status: value || undefined, page: undefined }); }
  function updatePage(next: number) { setPage(next); updateUrl({ page: next === 1 ? undefined : String(next) }); }
  function refresh() { setRefreshToken((token) => token + 1); }

  const title = titles[view];
  const loading = loadedKey !== loadKey;
  const needsFranchiseSelection = admin && !franchiseId;
  const canCreateLead = view === "crm";

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div><p className={styles.eyebrow}>SALES WORKSPACE</p><h1>{title.title}</h1><p>{title.description}</p></div>
        <div className={styles.headerActions}>
          {canCreateLead && <button type="button" className={styles.primaryButton} disabled={needsFranchiseSelection} onClick={() => setCreatingLead(true)}><Plus size={15} /> Add lead</button>}
          {view === "crm" && <button type="button" className={styles.secondaryButton} disabled={needsFranchiseSelection} onClick={() => setImportOpen(true)}><Upload size={15} /> Import JSON</button>}
          <button type="button" className={styles.secondaryButton} onClick={refresh}><RefreshCw size={15} /> Refresh</button>
        </div>
      </header>
      {needsFranchiseSelection && <div className={styles.infoBanner}><CircleAlert size={16} /> Select a franchise in the workspace header before creating or importing Sales records.</div>}
      {["crm", "customers", "lead-source"].includes(view) && (
        <div className={styles.filters}>
          <label className={styles.searchBox}><Search size={15} /><input aria-label="Search leads" value={query} onChange={(event) => updateQuery(event.currentTarget.value)} placeholder="Search name, company, email..." /></label>
          <select className={styles.filterSelect} value={status || (view === "customers" ? "won" : "")} onChange={(event) => updateStatus(event.currentTarget.value)} aria-label="Filter lead status">
            <option value="">All statuses</option>
            {["new", "contacted", "qualified", "proposal", "won", "lost"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      )}
      {error && loadedKey === loadKey && <div className={styles.errorPanel} role="alert"><CircleAlert size={18} /><div><strong>Sales data could not be loaded</strong><p>{error}</p></div><button type="button" className={styles.secondaryButton} onClick={refresh}>Retry</button></div>}
      {loading ? (
        <div className={styles.loadingPanel} role="status"><LoaderCircle className={styles.spinner} size={22} />Loading Sales data…</div>
      ) : !error && (
        <>
          {view === "dashboard" && <SalesDashboard data={objectOf(data) ?? {}} />}
          {["crm", "customers", "lead-source"].includes(view) && <LeadRegister data={data} view={view} page={page} onPage={updatePage} onSelect={setSelectedLead} pipelines={pipelines} admin={admin} canWrite={view !== "customers" && !needsFranchiseSelection} refresh={refresh} />}
          {(view === "calendar" || view === "follow-ups") && <ActivityList data={data} view={view} onOpen={(lead) => setSelectedLead(lead)} />}
          {(view === "work" || view === "approvals") && <TaskRegister data={data} view={view} admin={admin} page={page} onPage={updatePage} refresh={refresh} />}
          {view === "reports" && <SalesReports data={objectOf(data) ?? {}} />}
          {view === "assistant" && <AssistantPanel data={objectOf(data) ?? {}} />}
          {view === "integrations" && <SalesIntegrations results={Array.isArray(data) ? data : []} />}
        </>
      )}
      {selectedLead && <LeadDetails key={selectedLead._id} lead={selectedLead} pipelines={pipelines} admin={admin} onClose={() => setSelectedLead(null)} onSaved={() => { setSelectedLead(null); refresh(); }} />}
      {creatingLead && <LeadForm onClose={() => setCreatingLead(false)} onSave={async (input) => { await SalesService.createLead(input); toast.success("Lead created and assigned to you."); setCreatingLead(false); refresh(); }} />}
      {importOpen && <ImportPanel onClose={() => setImportOpen(false)} onImport={async (items) => { const response = await SalesService.importLeads(items); const created = Number(objectOf(response)?.created ?? 0); toast.success(`${created} lead${created === 1 ? "" : "s"} imported.`); setImportOpen(false); refresh(); }} />}
    </section>
  );
}

function SalesDashboard({ data }: { data: Record<string, unknown> }) {
  const metrics = objectOf(data.metrics) ?? {};
  const activities = Array.isArray(data.upcomingFollowUps) ? data.upcomingFollowUps as Array<Record<string, unknown>> : [];
  return (
    <>
      <div className={styles.metricGrid}>
        <Metric label="Leads in scope" value={metrics.totalLeads} />
        <Metric label="New leads" value={metrics.newLeads} tone="warning" />
        <Metric label="Qualified" value={metrics.qualified} tone="success" />
        <Metric label="Open tasks" value={metrics.openTasks} />
      </div>
      <div className={styles.contentGrid}>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Pipeline outcomes</h2><p>Counts by current lead status</p></div></div><div className={styles.quickStats}>{["contacted", "proposal", "won", "lost"].map((key) => <span key={key}><strong>{String(metrics[key] ?? 0)}</strong><small>{key}</small></span>)}</div></section>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Upcoming follow-ups</h2><p>From saved lead activities</p></div></div>{activities.map((activity) => <p className={styles.taskLine} key={String(activity._id)}><CalendarClock size={14} /> {String(activity.leadName)} · {String(activity.subject)} · {activity.dueAt ? new Date(String(activity.dueAt)).toLocaleString() : "—"}</p>)}{!activities.length && <p className={styles.emptyInline}>No upcoming follow-ups recorded.</p>}</section>
      </div>
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: unknown; tone?: "warning" | "success" }) {
  return <article className={`${styles.metricCard} ${tone ? styles[`metric${tone}`] : ""}`}><span>{label}</span><strong>{String(value ?? 0)}</strong></article>;
}

function LeadRegister({ data, view, page, onPage, onSelect, pipelines, admin, canWrite, refresh }: { data: unknown; view: SalesView; page: number; onPage: (page: number) => void; onSelect: (lead: SalesLead | null) => void; pipelines: SalesPipeline[]; admin: boolean; canWrite: boolean; refresh: () => void; }) {
  const response = objectOf(data);
  const items = Array.isArray(response?.items) ? response.items as SalesLead[] : [];
  const total = Number(response?.total ?? 0);
  const limit = Number(response?.limit ?? 20);
  const [display, setDisplay] = useState<"table" | "board">("table");
  const [pipelineForm, setPipelineForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteOtp, setDeleteOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<SalesLead["status"]>("new");
  const [bulkBusy, setBulkBusy] = useState(false);
  const activePipeline = pipelines[0];
  const selectable = admin && view !== "customers";

  useEffect(() => { setSelectedIds([]); setDeleteOtp(""); setOtpRequested(false); }, [view, page]);

  async function requestDeleteOtp() { setBulkBusy(true); try { await SalesService.requestDeletionOtp(selectedIds); setOtpRequested(true); toast.success("A deletion code was sent to the administrator email."); } catch (error) { toast.error(messageOf(error)); } finally { setBulkBusy(false); } }
  async function deleteSelected() { setBulkBusy(true); try { await SalesService.deleteLeads(selectedIds, deleteOtp); toast.success(`${selectedIds.length} lead(s) deleted.`); setSelectedIds([]); setDeleteOtp(""); setOtpRequested(false); refresh(); } catch (error) { toast.error(messageOf(error)); } finally { setBulkBusy(false); } }
  async function updateSelected() { setBulkBusy(true); try { await SalesService.bulkUpdateImported({ leadIds: selectedIds, status: bulkStatus }); toast.success(`${selectedIds.length} imported lead(s) updated.`); setSelectedIds([]); refresh(); } catch (error) { toast.error(messageOf(error)); } finally { setBulkBusy(false); } }

  return (
    <div className={styles.contentGrid}>
      <section className={styles.panel}>
        {view === "crm" && pipelines.length > 0 && (
          <div className={styles.tabs} role="tablist" aria-label="Lead pipeline">
            <button type="button" role="tab" aria-selected={display === "table"} className={display === "table" ? styles.tabActive : styles.tab} onClick={() => setDisplay("table")}>List</button>
            <button type="button" role="tab" aria-selected={display === "board"} className={display === "board" ? styles.tabActive : styles.tab} onClick={() => setDisplay("board")}>Pipeline board</button>
            {pipelines.map((pipeline) => <span key={pipeline._id} className={styles.sourceBadge}>{pipeline.name}</span>)}
            {admin && <button type="button" className={styles.textButton} disabled={!canWrite} onClick={() => setPipelineForm((open) => !open)}>Configure pipeline</button>}
          </div>
        )}
        {view === "crm" && !pipelines.length && <div className={styles.emptyNotice}>No pipeline is configured. An administrator can create the first pipeline here.</div>}
        {view === "crm" && admin && pipelineForm && <PipelineSetup onSaved={() => { setPipelineForm(false); refresh(); }} onClose={() => setPipelineForm(false)} />}
        <div className={styles.panelHeader}><div><h2>{view === "customers" ? "Customer list" : view === "lead-source" ? "Leads by source" : "Lead register"}</h2><p>{total} records in the current result</p></div></div>
        {selectable && <div className={styles.formActions}>
          <span>{selectedIds.length} selected</span>
          {view === "lead-source" && <><select aria-label="Set imported lead status" value={bulkStatus} onChange={(event) => setBulkStatus(event.currentTarget.value as SalesLead["status"])}>{["new", "contacted", "qualified", "proposal", "won", "lost"].map((item) => <option key={item} value={item}>{item}</option>)}</select><button type="button" className={styles.secondaryButton} disabled={!canWrite || !selectedIds.length || bulkBusy} onClick={() => void updateSelected()}>Update imported</button></>}
          <button type="button" className={styles.dangerButton} disabled={!canWrite || !selectedIds.length || bulkBusy} onClick={() => void requestDeleteOtp()}>Request deletion code</button>
          {otpRequested && <><label>One-time code<input inputMode="numeric" value={deleteOtp} onChange={(event) => setDeleteOtp(event.currentTarget.value)} /></label><button type="button" className={styles.dangerButton} disabled={!canWrite || !deleteOtp || bulkBusy} onClick={() => void deleteSelected()}>Delete selected</button></>}
        </div>}
        {view === "crm" && display === "board" && activePipeline ? (
          <PipelineBoard items={items} pipeline={activePipeline} onSelect={onSelect} canWrite={canWrite} onRefresh={refresh} />
        ) : <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead><tr>{selectable && <th><input aria-label="Select all leads on this page" type="checkbox" checked={items.length > 0 && items.every((lead) => selectedIds.includes(lead._id))} onChange={(event) => setSelectedIds(event.currentTarget.checked ? [...new Set([...selectedIds, ...items.map((lead) => lead._id)])] : selectedIds.filter((id) => !items.some((lead) => lead._id === id)))} /></th>}<th>Name</th><th>Company</th><th>Source</th><th>Owner</th><th>Status</th><th>Stage</th><th /></tr></thead>
            <tbody>
              {items.map((lead) => {
                const owner = typeof lead.ownerId === "object" ? lead.ownerId.name : "—";
                return <tr key={lead._id}>{selectable && <td><input aria-label={`Select ${lead.name}`} type="checkbox" checked={selectedIds.includes(lead._id)} onChange={(event) => setSelectedIds(event.currentTarget.checked ? [...selectedIds, lead._id] : selectedIds.filter((id) => id !== lead._id))} /></td>}<td>{lead.name}</td><td>{lead.company || "—"}</td><td>{lead.source || "—"}</td><td>{owner}</td><td><Status value={lead.status} /></td><td>{lead.stage || "—"}</td><td><button className={styles.textLink} type="button" onClick={() => onSelect(lead)}>Open <ArrowUpRight size={13} /></button></td></tr>;
              })}
              {!items.length && <tr><td className={styles.emptyCell} colSpan={selectable ? 8 : 7}>No leads match the current filters.</td></tr>}
            </tbody>
          </table>
        </div>}
        <SalesPagination page={page} pages={Math.max(1, Math.ceil(total / limit))} onPage={onPage} />
      </section>
    </div>
  );
}

function PipelineSetup({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [key, setKey] = useState(""); const [name, setName] = useState("");
  const [stages, setStages] = useState("New, Contacted, Qualified, Proposal, Won, Lost");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try { await SalesService.savePipeline(key.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"), { name, stages: stages.split(",").map((stage) => stage.trim()).filter(Boolean) }); toast.success("Pipeline saved."); onSaved(); }
    catch (error) { toast.error(messageOf(error)); } finally { setBusy(false); }
  }
  return <form className={styles.inlineForm} onSubmit={submit}><h3>Configure a pipeline</h3><div className={styles.formGrid}><label>Key<input value={key} onChange={(event) => setKey(event.currentTarget.value)} placeholder="default" required /></label><label>Name<input value={name} onChange={(event) => setName(event.currentTarget.value)} required /></label><label className={styles.fieldWide}>Stages (comma-separated)<input value={stages} onChange={(event) => setStages(event.currentTarget.value)} required /></label></div><div className={styles.formActions}><button className={styles.secondaryButton} type="button" onClick={onClose}>Cancel</button><button className={styles.primaryButton} type="submit" disabled={busy}>Save pipeline</button></div></form>;
}

function PipelineBoard({ items, pipeline, onSelect, canWrite, onRefresh }: { items: SalesLead[]; pipeline: SalesPipeline; onSelect: (lead: SalesLead) => void; canWrite: boolean; onRefresh: () => void }) {
  const columns = pipeline.stages.map((stage) => ({ stage, items: items.filter((lead) => lead.pipelineKey === pipeline.key && lead.stage === stage) }));
  const unassigned = items.filter((lead) => lead.pipelineKey !== pipeline.key || !pipeline.stages.includes(lead.stage));
  return <div className={styles.pipelineBoard}>
    {columns.map((column) => <section className={styles.pipelineColumn} key={column.stage}><h3>{column.stage}<span>{column.items.length}</span></h3>{column.items.map((lead) => <article className={styles.pipelineCard} key={lead._id}><button type="button" onClick={() => onSelect(lead)}><strong>{lead.name}</strong><small>{lead.company || lead.email || "—"}</small></button><select disabled={!canWrite} aria-label={`Move ${lead.name} to a different stage`} value={lead.stage} onChange={async (event) => { try { await SalesService.updateLead(lead._id, { pipelineKey: pipeline.key, stage: event.currentTarget.value }); toast.success("Lead stage updated."); onRefresh(); } catch (error) { toast.error(messageOf(error)); } }}>{pipeline.stages.map((stage) => <option key={stage}>{stage}</option>)}</select></article>)}</section>)}
    {!!unassigned.length && <section className={styles.pipelineColumn}><h3>Other / unassigned<span>{unassigned.length}</span></h3>{unassigned.map((lead) => <article className={styles.pipelineCard} key={lead._id}><button type="button" onClick={() => onSelect(lead)}><strong>{lead.name}</strong><small>{lead.company || lead.email || lead.stage}</small></button></article>)}</section>}
    {!columns.some((column) => column.items.length) && !unassigned.length && <p className={styles.emptyInline}>No leads exist in this pipeline.</p>}
  </div>;
}

function LeadDetails({ lead, pipelines, admin, onClose, onSaved }: { lead: SalesLead; pipelines: SalesPipeline[]; admin: boolean; onClose: () => void; onSaved: () => void; }) {
  const [status, setStatus] = useState(lead.status); const [pipelineKey, setPipelineKey] = useState(lead.pipelineKey); const [stage, setStage] = useState(lead.stage);
  const [ownerId, setOwnerId] = useState("");
  const [activity, setActivity] = useState({ type: "follow_up", subject: "", note: "", dueAt: "" });
  const [showInvoice, setShowInvoice] = useState(false); const [showPayment, setShowPayment] = useState(false);
  const [invoice, setInvoice] = useState({ description: "", quantity: "1", unitPrice: "", dueDate: "" });
  const [payment, setPayment] = useState({ invoiceId: "", amount: "", method: "bank_transfer", reference: "" });
  const [relatedInvoices, setRelatedInvoices] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(false);
  const selectedPipeline = pipelines.find((item) => item.key === pipelineKey);
  useEffect(() => { let active = true; SalesService.invoices(lead._id).then((result) => { const records = objectOf(result); if (active && Array.isArray(records?.items)) setRelatedInvoices(records.items as Array<Record<string, unknown>>); }).catch((error: unknown) => { if (active) toast.error(messageOf(error)); }); return () => { active = false; }; }, [lead._id]);
  async function run(action: () => Promise<unknown>, message: string) { setBusy(true); try { await action(); toast.success(message); onSaved(); } catch (error) { toast.error(messageOf(error)); } finally { setBusy(false); } }
  async function saveLead(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await run(() => SalesService.updateLead(lead._id, { status, pipelineKey, stage }), "Lead updated."); }
  async function addActivity(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await run(() => SalesService.createActivity(lead._id, { ...activity, ...(activity.dueAt ? { dueAt: new Date(activity.dueAt).toISOString() } : {}) }), "Activity added."); }
  async function createLeadInvoice(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await run(() => SalesService.createInvoice(lead._id, { lineItems: [{ description: invoice.description, quantity: Number(invoice.quantity), unitPrice: Number(invoice.unitPrice), taxRate: 0 }], ...(invoice.dueDate ? { dueDate: invoice.dueDate } : {}), notes: "" }), "Invoice draft created."); }
  async function createLeadPayment(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await run(() => SalesService.createPayment(lead._id, { ...(payment.invoiceId ? { invoiceId: payment.invoiceId } : {}), amount: Number(payment.amount), method: payment.method, reference: payment.reference, note: "" }), "Payment record created."); }
  async function assign(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await run(() => SalesService.assignLead(lead._id, ownerId), "Lead owner updated."); }
  return (
    <aside className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>{lead.name}</h2><p>{lead.company || lead.email || "Lead details"}</p></div><button className={styles.iconAction} type="button" onClick={onClose} aria-label="Close lead details"><X size={15} /></button></div>
      <div className={styles.detailGrid}><Detail label="Email" value={lead.email || "—"} /><Detail label="Phone" value={lead.phone || "—"} /><Detail label="Source" value={lead.source || "—"} /><Detail label="Pipeline" value={lead.pipelineKey || "—"} /></div>
      <form className={styles.inlineForm} onSubmit={saveLead}><h3>Pipeline and status</h3><div className={styles.formGrid}><label>Status<select value={status} onChange={(event) => setStatus(event.currentTarget.value as SalesLead["status"])}>{["new", "contacted", "qualified", "proposal", "won", "lost"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Pipeline<select value={pipelineKey} onChange={(event) => { const v = event.currentTarget.value; setPipelineKey(v); setStage(pipelines.find((item) => item.key === v)?.stages[0] ?? ""); }}>{pipelines.length ? pipelines.map((item) => <option key={item.key} value={item.key}>{item.name}</option>) : <option value={pipelineKey}>{pipelineKey || "No pipeline"}</option>}</select></label><label>Stage<select value={stage} onChange={(event) => setStage(event.currentTarget.value)}>{(selectedPipeline?.stages ?? [lead.stage]).map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div><div className={styles.formActions}><button type="submit" className={styles.primaryButton} disabled={busy}>Save lead</button><button type="button" className={styles.dangerButton} onClick={() => window.confirm("Archive this lead?") && void run(() => SalesService.archiveLead(lead._id), "Lead archived.")}>Archive</button></div></form>
      {admin && <form className={styles.inlineForm} onSubmit={assign}><h3>Assign owner</h3><div className={styles.formGrid}><label>Active franchise user ID<input value={ownerId} onChange={(event) => setOwnerId(event.currentTarget.value)} required /></label></div><button className={styles.secondaryButton} type="submit" disabled={busy}>Assign lead</button></form>}
      <form className={styles.inlineForm} onSubmit={addActivity}><h3>Add activity or follow-up</h3><div className={styles.formGrid}><label>Type<select value={activity.type} onChange={(event) => setActivity((current) => ({ ...current, type: event.currentTarget.value }))}>{["call", "email", "meeting", "note", "follow_up"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Subject<input value={activity.subject} onChange={(event) => setActivity((current) => ({ ...current, subject: event.currentTarget.value }))} minLength={2} required /></label><label>Due at<input type="datetime-local" value={activity.dueAt} onChange={(event) => setActivity((current) => ({ ...current, dueAt: event.currentTarget.value }))} /></label><label>Note<input value={activity.note} onChange={(event) => setActivity((current) => ({ ...current, note: event.currentTarget.value }))} /></label></div><button className={styles.secondaryButton} type="submit" disabled={busy}>Add activity</button></form>
      <div className={styles.inlineForm}><h3>Activity history</h3>{(lead.activities ?? []).map((item) => <p className={styles.taskLine} key={item._id}><CalendarClock size={13} /> {item.subject} · {item.dueAt ? new Date(item.dueAt).toLocaleString() : item.type} {item.completedAt ? "· Completed" : <button className={styles.textButton} type="button" onClick={() => void run(() => SalesService.completeActivity(lead._id, item._id), "Activity completed.")}>Complete</button>}</p>)}{!lead.activities?.length && <p className={styles.emptyInline}>No activities recorded.</p>}</div>
      <div className={styles.inlineForm}><h3>Invoices and payments</h3>{relatedInvoices.map((item) => <p className={styles.taskLine} key={String(item._id)}><Link className={styles.tableLink} href={`/dashboard/finance/billing/invoices/${String(item._id)}`}>{String(item.invoiceNumber)}</Link> · {String(item.status)} · {String(item.total)}</p>)}<div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={() => setShowInvoice((open) => !open)}><FilePlus2 size={14} /> Create invoice</button><button type="button" className={styles.secondaryButton} onClick={() => setShowPayment((open) => !open)}><Plus size={14} /> Record payment</button></div>
        {showInvoice && <form className={styles.formGrid} onSubmit={createLeadInvoice}><label>Description<input value={invoice.description} onChange={(event) => setInvoice((current) => ({ ...current, description: event.currentTarget.value }))} required /></label><label>Quantity<input type="number" min="0.01" step="0.01" value={invoice.quantity} onChange={(event) => setInvoice((current) => ({ ...current, quantity: event.currentTarget.value }))} required /></label><label>Unit price<input type="number" min="0" step="0.01" value={invoice.unitPrice} onChange={(event) => setInvoice((current) => ({ ...current, unitPrice: event.currentTarget.value }))} required /></label><label>Due date<input type="date" value={invoice.dueDate} onChange={(event) => setInvoice((current) => ({ ...current, dueDate: event.currentTarget.value }))} /></label><button className={styles.primaryButton} type="submit" disabled={busy}>Create draft</button></form>}
        {showPayment && <form className={styles.formGrid} onSubmit={createLeadPayment}><label>Invoice ID (optional)<input value={payment.invoiceId} onChange={(event) => setPayment((current) => ({ ...current, invoiceId: event.currentTarget.value }))} /></label><label>Amount<input type="number" min="0.01" step="0.01" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.currentTarget.value }))} required /></label><label>Method<select value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.currentTarget.value }))}><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="razorpay">Razorpay</option><option value="other">Other</option></select></label><label>Reference<input value={payment.reference} onChange={(event) => setPayment((current) => ({ ...current, reference: event.currentTarget.value }))} /></label><button className={styles.primaryButton} type="submit" disabled={busy}>Record payment</button></form>}
      </div>
    </aside>
  );
}

function LeadForm({ onClose, onSave }: { onClose: () => void; onSave: (input: SalesLeadInput) => Promise<void> }) {
  const [values, setValues] = useState({ name: "", email: "", phone: "", company: "", source: "manual", notes: "" });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); try { await onSave(values); } catch (error) { toast.error(messageOf(error)); } finally { setBusy(false); } }
  return <div className={styles.modalBackdrop}><section className={styles.formDialog} role="dialog" aria-modal="true" aria-labelledby="sales-lead-title"><div className={styles.panelHeader}><div><h2 id="sales-lead-title">Create lead</h2><p>New leads are assigned to your account.</p></div><button className={styles.iconAction} type="button" onClick={onClose} aria-label="Close"><X size={15} /></button></div><form className={styles.formGrid} onSubmit={submit}>{(["name", "email", "phone", "company", "source", "notes"] as const).map((field) => <label key={field}>{field}<input type={field === "email" ? "email" : "text"} value={values[field]} onChange={(event) => setValues((current) => ({ ...current, [field]: event.currentTarget.value }))} required={field === "name"} /></label>)}<div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button><button className={styles.primaryButton} type="submit" disabled={busy}>Create lead</button></div></form></section></div>;
}

function ImportPanel({ onClose, onImport }: { onClose: () => void; onImport: (items: Array<Record<string, unknown>>) => Promise<void> }) {
  const [json, setJson] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); try { const parsed: unknown = JSON.parse(json); if (!Array.isArray(parsed)) throw new Error("Provide a JSON array of lead records."); setBusy(true); await onImport(parsed as Array<Record<string, unknown>>); } catch (error) { toast.error(messageOf(error)); } finally { setBusy(false); } }
  return <div className={styles.modalBackdrop}><section className={styles.formDialog} role="dialog" aria-modal="true" aria-labelledby="sales-import-title"><div className={styles.panelHeader}><div><h2 id="sales-import-title">Import leads</h2><p>Paste a JSON array with name and optional contact/source fields.</p></div><button className={styles.iconAction} type="button" onClick={onClose} aria-label="Close"><X size={15} /></button></div><form onSubmit={submit}><label className={styles.jsonLabel}>Lead JSON<textarea value={json} onChange={(event) => setJson(event.currentTarget.value)} placeholder={'[{"name":"Example lead","email":"lead@example.com"}]'} rows={8} required /></label><div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button><button className={styles.primaryButton} type="submit" disabled={busy}>Import</button></div></form></section></div>;
}

function ActivityList({ data, view, onOpen }: { data: unknown; view: "calendar" | "follow-ups"; onOpen: (lead: SalesLead) => void }) {
  const leads = listOf<SalesLead>(data);
  const activities = leads.flatMap((lead) => (lead.activities ?? []).filter((activity) => !activity.completedAt && activity.dueAt).map((activity) => ({ lead, activity })))
    .sort((a, b) => new Date(a.activity.dueAt ?? "").getTime() - new Date(b.activity.dueAt ?? "").getTime());
  return <section className={styles.panel}><div className={styles.panelHeader}><div><h2>{view === "calendar" ? "Upcoming activity" : "Open follow-ups"}</h2><p>From your assigned leads</p></div></div><div className={styles.tableScroll}><table className={styles.dataTable}><thead><tr><th>Due</th><th>Lead</th><th>Activity</th><th>Type</th><th /></tr></thead><tbody>{activities.map(({ lead, activity }) => <tr key={`${lead._id}-${activity._id}`}><td>{new Date(activity.dueAt ?? "").toLocaleString()}</td><td>{lead.name}</td><td>{activity.subject}</td><td>{activity.type}</td><td><button className={styles.textButton} type="button" onClick={() => onOpen(lead)}>Open lead</button></td></tr>)}{!activities.length && <tr><td colSpan={5} className={styles.emptyCell}>No scheduled activities found in the loaded lead records.</td></tr>}</tbody></table></div></section>;
}

function TaskRegister({ data, view, admin, page, onPage, refresh }: { data: unknown; view: "work" | "approvals"; admin: boolean; page: number; onPage: (page: number) => void; refresh: () => void }) {
  const response = objectOf(data);
  const tasks = Array.isArray(response?.items) ? response.items as SalesTask[] : [];
  const total = Number(response?.total ?? 0); const limit = Number(response?.limit ?? 20);
  const [report, setReport] = useState<Record<string, string>>({});
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [taskTitle, setTaskTitle] = useState(""); const [creating, setCreating] = useState(false);
  async function act(action: () => Promise<unknown>, success: string) { try { await action(); toast.success(success); refresh(); } catch (error) { toast.error(messageOf(error)); } }
  async function handleCreateTask(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setCreating(true); try { await SalesService.createTask({ title: taskTitle, accountability: true }); toast.success("Task created."); setTaskTitle(""); refresh(); } catch (error) { toast.error(messageOf(error)); } finally { setCreating(false); } }
  return <section className={styles.panel}><div className={styles.panelHeader}><div><h2>{view === "work" ? "My assigned work" : "Reports awaiting review"}</h2><p>{total} accountability tasks in this list</p></div></div>{view === "work" && <form className={styles.actionBar} onSubmit={handleCreateTask}><input className={styles.inlineInput} value={taskTitle} onChange={(event) => setTaskTitle(event.currentTarget.value)} placeholder="New task title" minLength={2} required /><button className={styles.primaryButton} type="submit" disabled={creating}><Plus size={14} /> Create task</button></form>}<div className={styles.tableScroll}><table className={styles.dataTable}><thead><tr><th>Task</th><th>Lead</th><th>Due</th><th>Priority</th><th>Status</th><th>Report / action</th></tr></thead><tbody>{tasks.map((task) => { const lead = typeof task.leadId === "object" ? task.leadId.name : "—"; return <tr key={task._id}><td>{task.title}<small className={styles.rowDescription}>{task.description}</small></td><td>{lead}</td><td>{task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "—"}</td><td>{task.priority}</td><td><Status value={view === "approvals" ? task.reviewStatus : task.status} /></td><td>{view === "approvals" && admin ? <div className={styles.approvalActions}><input value={reviewNote[task._id] ?? ""} onChange={(event) => setReviewNote((current) => ({ ...current, [task._id]: event.currentTarget.value }))} placeholder="Review note" /><button type="button" onClick={() => void act(() => SalesService.reviewTask(task._id, "approved", reviewNote[task._id] ?? ""), "Work report approved.")}>Approve</button><button type="button" onClick={() => void act(() => SalesService.reviewTask(task._id, "rejected", reviewNote[task._id] ?? ""), "Work report rejected.")}>Reject</button></div> : task.status === "open" ? <div className={styles.approvalActions}><input value={report[task._id] ?? ""} onChange={(event) => setReport((current) => ({ ...current, [task._id]: event.currentTarget.value }))} placeholder="Work report" /><button type="button" onClick={() => void act(() => SalesService.submitReport(task._id, report[task._id] ?? ""), "Report submitted.")}>Submit report</button><button type="button" onClick={() => void act(() => SalesService.completeTask(task._id), "Task completed.")}>Complete</button></div> : task.report || "—"}</td></tr>; })}{!tasks.length && <tr><td className={styles.emptyCell} colSpan={6}>{view === "approvals" ? "No submitted work reports await review." : "No work items are assigned yet."}</td></tr>}</tbody></table></div><SalesPagination page={page} pages={Math.max(1, Math.ceil(total / limit))} onPage={onPage} /></section>;
}

function SalesReports({ data }: { data: Record<string, unknown> }) {
  const byStatus = Array.isArray(data.byStatus) ? data.byStatus as Array<{ _id: string; count: number }> : [];
  const bySource = Array.isArray(data.bySource) ? data.bySource as Array<{ _id: string; count: number }> : [];
  return <div className={styles.contentGrid}><section className={styles.panel}><div className={styles.panelHeader}><div><h2>Lead status</h2><p>Live counts from the Sales API</p></div></div>{byStatus.map((row) => <p className={styles.reportRow} key={row._id}><Status value={row._id} /><strong>{row.count}</strong></p>)}{!byStatus.length && <p className={styles.emptyInline}>No leads to report.</p>}</section><section className={styles.panel}><div className={styles.panelHeader}><div><h2>Lead sources</h2><p>Recorded source field totals</p></div></div>{bySource.map((row) => <p className={styles.reportRow} key={row._id}><span>{row._id || "Unspecified"}</span><strong>{row.count}</strong></p>)}<p className={styles.reportRow}><span>Completed tasks</span><strong>{String(data.completedTasks ?? 0)}</strong></p></section></div>;
}

function AssistantPanel({ data }: { data: Record<string, unknown> }) {
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function send(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); try { await SalesService.assistantChat(message); } catch (caughtError) { setError(messageOf(caughtError)); } }
  return <section className={styles.integrationState}><CircleAlert size={21} /><h2>Assistant provider not configured</h2><p>{String(data.message ?? "Sales AI is unavailable until a provider is configured.")}</p><form className={styles.assistantForm} onSubmit={send}><input value={message} onChange={(event) => setMessage(event.currentTarget.value)} placeholder="Ask a question..." required /><button className={styles.primaryButton} type="submit">Send</button></form>{error && <p role="alert">{error}</p>}</section>;
}

function SalesIntegrations({ results }: { results: unknown[] }) {
  const labels = ["WhatsApp accounts", "WhatsApp templates", "Messaging campaigns"];
  return <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Connected providers</h2><p>No external messaging action will be simulated.</p></div></div><div className={styles.integrationRows}>{labels.map((label, index) => { const result = results[index] as PromiseSettledResult<unknown> | undefined; const error = result?.status === "rejected" ? messageOf(result.reason) : "Provider not configured."; return <article key={label}><div><h3>{label}</h3><p>{error}</p></div><Status value="unavailable" /></article>; })}</div></section>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className={styles.detailItem}><span>{label}</span><strong>{value}</strong></div>; }

function SalesPagination({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  return <div className={styles.pagination}><span>Page {page} of {pages}</span><div><button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous page">‹</button><button type="button" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages} aria-label="Next page">›</button></div></div>;
}
