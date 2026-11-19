"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, CircleAlert, FilePlus2, LoaderCircle, Plus, RefreshCw, Search, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { FinanceService } from "@/services/finance.service";
import { useAppSelector } from "@/redux/hooks";
import type { BillingDashboardResponse, CostPlanRow, FinanceInvoice, FinanceInvoiceInput, FinanceList, FinancePayment, FinancePaymentInput, FinancePlanKind, FinanceSummaryResponse, ResourcePlanRow, RevenueStream } from "@/services/types/finance.types";
import styles from "./finance-workspace.module.css";

export type FinanceView = "overview" | "revenue" | "resources" | "costs" | "summary" | "forecast" | "billing" | "accounting" | "invoices" | "invoice-detail" | "payments" | "payment-detail";

const pageTitles: Record<FinanceView, { title: string; description: string }> = {
  overview: { title: "Finance Overview", description: "Revenue, invoices and payment status across your workspace." },
  revenue: { title: "Revenue Projections", description: "Plan expected income streams across the fiscal year." },
  resources: { title: "Resource Planning", description: "Plan staffing capacity and costs by role." },
  costs: { title: "Cost Planning", description: "Plan recurring and one-time expenses for the fiscal year." },
  summary: { title: "Financial Summary", description: "Review actuals, outstanding balances and approved plans." },
  forecast: { title: "AI Forecast", description: "Forecasts are only available when an AI provider is configured." },
  billing: { title: "Billing Dashboard", description: "Monitor issued invoices, verified receipts and outstanding balances." },
  accounting: { title: "Accounting", description: "Review journals, elimination requests, credit notes and billing settings." },
  invoices: { title: "Invoices", description: "Create and manage invoice records for your franchise." },
  "invoice-detail": { title: "Invoice Details", description: "Review invoice status, payments and available actions." },
  payments: { title: "Payments", description: "Review payment submissions, proof documents and refunds." },
  "payment-detail": { title: "Payment Details", description: "Review proof, verification history and payment actions." },
};

function currentFiscalYearStart() { const now = new Date(); return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; }
function formatMoney(value: number, currency = "INR") { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0); }
function recordOf(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null; }
function apiMessage(error: unknown) { return error instanceof Error ? error.message : "The Finance request failed."; }
function downloadBlob(blob: Blob, fileName: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }

type FinanceWorkspaceProps = { view: FinanceView; resourceId?: string; fiscalYearStart: number; initialQuery: string; initialStatus: string; initialPage: number; };

export default function FinanceWorkspace({ view, resourceId, fiscalYearStart: initialYear, initialQuery, initialStatus, initialPage }: FinanceWorkspaceProps) {
  const pathname = usePathname(); const router = useRouter();
  const user = useAppSelector((state) => state.auth.user); const admin = user?.user_role === "admin";
  const [franchiseId, setFranchiseId] = useState<string>(() => (typeof window !== "undefined" ? window.localStorage.getItem("dashboard-franchise-scope") ?? "" : ""));
  const [year, setYear] = useState(initialYear || currentFiscalYearStart());
  const [query, setQuery] = useState(initialQuery); const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(initialPage); const [refreshVersion, setRefreshVersion] = useState(0);
  const [data, setData] = useState<unknown>(null); const [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false); const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [accountingTab, setAccountingTab] = useState<"journals" | "eliminations" | "credit-notes" | "settings">("journals");
  const loadKey = [view, resourceId ?? "", year, query, status, page, refreshVersion, franchiseId].join(":");

  useEffect(() => { const updateScope = () => setFranchiseId(window.localStorage.getItem("dashboard-franchise-scope") ?? ""); updateScope(); window.addEventListener("dashboard-scope-change", updateScope); return () => window.removeEventListener("dashboard-scope-change", updateScope); }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        let result: unknown;
        if (view === "overview" || view === "billing") result = await FinanceService.dashboard(admin && !franchiseId);
        else if (view === "summary") result = await FinanceService.summary(year);
        else if (view === "revenue" || view === "resources" || view === "costs") { const kind: FinancePlanKind = view === "revenue" ? "revenue" : view === "resources" ? "resource" : "cost"; result = await FinanceService.plan(kind, year); }
        else if (view === "forecast") result = await FinanceService.aiForecast(year);
        else if (view === "accounting") {
          const [journals, eliminations, creditNotes, settings] = await Promise.all([
            admin ? FinanceService.journals({ page, limit: 20 }) : Promise.resolve({ success: true, items: [], total: 0, page, limit: 20 }),
            FinanceService.eliminations({ page, limit: 20, status: status || undefined }),
            FinanceService.creditNotes({ page, limit: 20 }),
            FinanceService.settings().catch(() => ({ success: true, settings: null })),
          ]);
          result = { journals, eliminations, creditNotes, settings };
        }
        else if (view === "invoices") result = await FinanceService.invoices({ q: query || undefined, status: status || undefined, page, limit: 20 });
        else if (view === "invoice-detail" && resourceId) result = await FinanceService.invoice(resourceId);
        else if (view === "payments") result = status === "refunds" ? await FinanceService.refunds({ page, limit: 20 }) : await FinanceService.payments({ q: query || undefined, status: status || undefined, page, limit: 20 });
        else if (view === "payment-detail" && resourceId) result = await FinanceService.payment(resourceId);
        if (active) { setData(result ?? null); setError(""); setLoadedKey(loadKey); }
      } catch (caughtError) { if (active) { setError(apiMessage(caughtError)); setLoadedKey(loadKey); } }
    };
    void load();
    return () => { active = false; };
  }, [admin, franchiseId, loadKey, page, query, resourceId, status, view, year]);

  function updateUrl(next: Record<string, string | undefined>) { const params = new URLSearchParams(window.location.search); for (const [key, value] of Object.entries(next)) { if (value) params.set(key, value); else params.delete(key); } const suffix = params.toString(); router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false }); }
  function changeYear(nextYear: number) { setYear(nextYear); updateUrl({ fiscalYearStart: String(nextYear) }); }
  function refresh() { setRefreshVersion((value) => value + 1); }
  function changeQuery(value: string) { setQuery(value); setPage(1); updateUrl({ q: value || undefined, page: undefined }); }
  function changeStatus(value: string) { setStatus(value); setPage(1); updateUrl({ status: value || undefined, page: undefined }); }
  function changePage(nextPage: number) { setPage(nextPage); updateUrl({ page: nextPage === 1 ? undefined : String(nextPage) }); }

  const isLoading = loadedKey !== loadKey;
  const title = pageTitles[view];
  const needsSpecificFranchise = admin && !franchiseId && ["revenue", "resources", "costs", "forecast", "accounting"].includes(view);

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div><p className={styles.eyebrow}>FINANCE WORKSPACE</p><h1>{title.title}</h1><p>{title.description}</p></div>
        <div className={styles.headerActions}>
          {["revenue", "resources", "costs", "summary", "forecast"].includes(view) && <label className={styles.yearPicker}><span>Fiscal year</span><select value={year} onChange={(event) => changeYear(Number(event.currentTarget.value))} aria-label="Select fiscal year start">{Array.from({ length: 6 }, (_, index) => { const value = currentFiscalYearStart() - index; return <option key={value} value={value}>FY {value}–{value + 1}</option>; })}</select></label>}
          <button type="button" className={styles.secondaryButton} onClick={refresh} aria-label="Refresh Finance data" title="Refresh"><RefreshCw size={15} />Refresh</button>
          {view === "invoices" && <button type="button" className={styles.primaryButton} onClick={() => setShowInvoiceForm((open) => !open)}><FilePlus2 size={16} />New invoice</button>}
          {view === "payments" && status !== "refunds" && <button type="button" className={styles.primaryButton} onClick={() => setShowPaymentForm((open) => !open)}><Plus size={16} />Record payment</button>}
        </div>
      </header>
      {needsSpecificFranchise && <div className={styles.infoBanner}><CircleAlert size={17} /><span>{view === "accounting" ? "Select one franchise in the workspace header before creating or changing accounting records." : "Select one franchise in the workspace header to view or edit this fiscal-year data."}</span></div>}
      {view === "invoices" && <div className={styles.filters}><label className={styles.searchBox}><Search size={15} /><input value={query} onChange={(event) => changeQuery(event.currentTarget.value)} placeholder="Search invoice or customer..." aria-label="Search invoices" /></label><select className={styles.filterSelect} value={status} onChange={(event) => changeStatus(event.currentTarget.value)} aria-label="Filter invoices by status"><option value="">All statuses</option><option value="draft">Draft</option><option value="issued">Issued</option><option value="partially_paid">Partially paid</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option></select></div>}
      {view === "payments" && <div className={styles.filters}><label className={styles.searchBox}><Search size={15} /><input value={query} onChange={(event) => changeQuery(event.currentTarget.value)} placeholder="Search payment reference..." aria-label="Search payments" /></label><select className={styles.filterSelect} value={status} onChange={(event) => changeStatus(event.currentTarget.value)} aria-label="Filter payment status"><option value="">All payments</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="reversed">Reversed</option><option value="refunds">Refunds</option></select></div>}
      {error && loadedKey === loadKey && <div className={styles.errorPanel} role="alert"><CircleAlert size={18} /><div><strong>Finance data could not be loaded</strong><p>{error}</p></div><button className={styles.secondaryButton} type="button" onClick={refresh}>Retry</button></div>}
      {isLoading ? <div className={styles.loadingPanel} role="status"><LoaderCircle size={22} className={styles.spinner} /><span>Loading Finance data…</span></div> : !error && (
        <>
          {(view === "overview" || view === "billing") && <BillingDashboard data={data as BillingDashboardResponse} />}
          {view === "summary" && <FinancialSummary data={data as FinanceSummaryResponse} />}
          {(view === "revenue" || view === "resources" || view === "costs") && <PlanEditor key={`${view}-${year}-${refreshVersion}`} kind={view === "revenue" ? "revenue" : view === "resources" ? "resource" : "cost"} fiscalYearStart={year} initialData={recordOf(data)?.data ?? null} disabled={needsSpecificFranchise} onDeleted={refresh} onSave={async (input) => { await FinanceService.savePlan(view === "revenue" ? "revenue" : view === "resources" ? "resource" : "cost", year, input); toast.success("Fiscal-year plan saved."); refresh(); }} />}
          {view === "forecast" && <ForecastResult data={data} />}
          {view === "accounting" && <AccountingWorkspace data={recordOf(data) ?? {}} tab={accountingTab} onTab={(tab) => { setAccountingTab(tab); changePage(1); }} admin={admin} disabled={needsSpecificFranchise} refresh={refresh} page={page} onPage={changePage} />}
          {view === "invoices" && <InvoiceList data={data as FinanceList<FinanceInvoice>} page={page} onPage={changePage} />}
          {view === "invoice-detail" && <InvoiceDetail key={resourceId} invoice={(recordOf(data)?.invoice as FinanceInvoice | undefined) ?? null} admin={admin} onBack={() => router.push("/dashboard/finance/billing/invoices")} onRefresh={refresh} />}
          {view === "payments" && <PaymentList data={data} page={page} refunds={status === "refunds"} onPage={changePage} />}
          {view === "payment-detail" && <PaymentDetail key={resourceId} payment={(recordOf(data)?.payment as FinancePayment | undefined) ?? null} admin={admin} onBack={() => router.push("/dashboard/finance/billing/payments")} onRefresh={refresh} />}
        </>
      )}
      {showInvoiceForm && <InvoiceForm disabled={admin && !franchiseId} onClose={() => setShowInvoiceForm(false)} onSave={async (input) => { const result = await FinanceService.createInvoice(input); toast.success("Draft invoice created."); setShowInvoiceForm(false); refresh(); router.push(`/dashboard/finance/billing/invoices/${result.invoice._id}`); }} />}
      {showPaymentForm && <PaymentForm disabled={admin && !franchiseId} onClose={() => setShowPaymentForm(false)} onSave={async (input) => { await FinanceService.createPayment(input); toast.success("Payment record created. Attach proof from its detail page."); setShowPaymentForm(false); refresh(); }} />}
    </section>
  );
}

function BillingDashboard({ data }: { data: BillingDashboardResponse }) {
  const summary = data.summary;
  const max = Math.max(summary.totalInvoiced, summary.received, summary.outstanding, 1);
  return (
    <>
      <div className={styles.metricGrid}><MetricCard label="Total invoiced" value={formatMoney(summary.totalInvoiced)} /><MetricCard label="Received" value={formatMoney(summary.received)} tone="success" /><MetricCard label="Outstanding" value={formatMoney(summary.outstanding)} tone="warning" /><MetricCard label="Overdue invoices" value={String(summary.overdueInvoices)} tone="danger" /></div>
      <div className={styles.contentGrid}>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Billing activity</h2><p>Recorded invoice and verified payment totals</p></div><span className={styles.sourceBadge}>{data.source === "all_franchises" ? "All franchises" : "Selected scope"}</span></div><div className={styles.barChart} aria-label="Billing totals chart">{[{ label: "Invoiced", value: summary.totalInvoiced, tone: "blue" }, { label: "Received", value: summary.received, tone: "green" }, { label: "Outstanding", value: summary.outstanding, tone: "amber" }].map((item) => <div className={styles.barRow} key={item.label}><span>{item.label}</span><div className={styles.barTrack}><span className={styles[item.tone]} style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} /></div><strong>{formatMoney(item.value)}</strong></div>)}</div></section>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Invoice status</h2><p>Current records in scope</p></div></div><div className={styles.quickStats}><span><strong>{summary.invoiceCount}</strong><small>Invoices</small></span><span><strong>{summary.paymentCount}</strong><small>Payments</small></span><span><strong>{formatMoney(summary.outstanding)}</strong><small>To collect</small></span></div></section>
      </div>
      <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Recent invoices</h2><p>Latest records returned by the billing API</p></div><Link className={styles.textLink} href="/dashboard/finance/billing/invoices">View all <ArrowUpRight size={14} /></Link></div><InvoiceTable items={data.recentInvoices} /></section>
    </>
  );
}

function MetricCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "warning" | "danger" }) { return <article className={`${styles.metricCard} ${styles[`metric${tone}`]}`}><span>{label}</span><strong>{value}</strong></article>; }

function FinancialSummary({ data }: { data: FinanceSummaryResponse }) {
  const max = Math.max(data.actualRevenue, data.projectedRevenue, data.plannedCosts, 1);
  return (
    <>
      {!data.hasSourceData && <div className={styles.emptyNotice}>No invoice, payment, or planning records exist for this fiscal year yet.</div>}
      <div className={styles.metricGrid}><MetricCard label="Verified actual revenue" value={formatMoney(data.actualRevenue)} tone="success" /><MetricCard label="Invoiced revenue" value={formatMoney(data.invoicedRevenue)} /><MetricCard label="Outstanding" value={formatMoney(data.outstanding)} tone="warning" /><MetricCard label="Projected net" value={formatMoney(data.projectedNet)} tone={data.projectedNet < 0 ? "danger" : "neutral"} /></div>
      <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Fiscal-year comparison</h2><p>Values calculated from saved plans and payment records</p></div><span className={styles.sourceBadge}>FY {data.fiscalYearStart}–{data.fiscalYearStart + 1}</span></div><div className={styles.barChart}>{[{ label: "Actual revenue", value: data.actualRevenue, tone: "green" }, { label: "Projected revenue", value: data.projectedRevenue, tone: "blue" }, { label: "Planned costs", value: data.plannedCosts, tone: "amber" }].map((item) => <div className={styles.barRow} key={item.label}><span>{item.label}</span><div className={styles.barTrack}><span className={styles[item.tone]} style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} /></div><strong>{formatMoney(item.value)}</strong></div>)}</div></section>
    </>
  );
}

function PlanEditor({ kind, fiscalYearStart, initialData, disabled, onDeleted, onSave }: { kind: FinancePlanKind; fiscalYearStart: number; initialData: unknown; disabled: boolean; onDeleted: () => void; onSave: (input: { streams: RevenueStream[] } | { resources: ResourcePlanRow[] } | { costs: CostPlanRow[] }) => Promise<void>; }) {
  const record = recordOf(initialData);
  const [streams, setStreams] = useState<RevenueStream[]>((record?.streams as RevenueStream[] | undefined) ?? []);
  const [resources, setResources] = useState<ResourcePlanRow[]>((record?.resources as ResourcePlanRow[] | undefined) ?? []);
  const [costs, setCosts] = useState<CostPlanRow[]>((record?.costs as CostPlanRow[] | undefined) ?? []);
  const [saving, setSaving] = useState(false);
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [otpRequested, setOtpRequested] = useState(false); const [otp, setOtp] = useState("");
  useEffect(() => { setOtp(""); setOtpRequested(false); }, [selectedStreams.length]);
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); try { const payload = kind === "revenue" ? { streams } : kind === "resource" ? { resources } : { costs }; await onSave(payload); } catch (error) { toast.error(apiMessage(error)); } finally { setSaving(false); } }
  async function requestDeletionCode() { try { await FinanceService.requestRevenueDeletionOtp(fiscalYearStart); setOtpRequested(true); toast.success("A one-time code was sent to your account email."); } catch (error) { toast.error(apiMessage(error)); } }
  async function deleteSelectedStreams(event: FormEvent<HTMLFormElement>) { event.preventDefault(); try { await FinanceService.deleteRevenueStreams(fiscalYearStart, selectedStreams, otp); toast.success("Selected revenue streams deleted."); setStreams((rows) => rows.filter((row) => !row.id || !selectedStreams.includes(row.id))); setOtp(""); setSelectedStreams([]); setOtpRequested(false); onDeleted(); } catch (error) { toast.error(apiMessage(error)); } }
  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const planTitle = kind === "revenue" ? "Revenue streams" : kind === "resource" ? "Planned resources" : "Cost categories";
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>{planTitle}</h2><p>FY {fiscalYearStart}–{fiscalYearStart + 1} · Changes are saved to the selected franchise.</p></div><span className={styles.sourceBadge}>{initialData ? "Saved plan" : "No saved plan"}</span></div>
      {disabled ? <div className={styles.emptyNotice}>Select one franchise to edit its plan.</div> : (
        <form onSubmit={save}>
          {kind === "revenue" && <div className={styles.tableScroll}><table className={styles.planTable}><thead><tr><th>Stream</th><th>Category</th><th>Probability</th>{months.map((month) => <th key={month}>{month}</th>)}<th /></tr></thead><tbody>{streams.map((stream, index) => <tr key={stream.id ?? index}><td><input required value={stream.name} onChange={(event) => setStreams((rows) => rows.map((row, i) => i === index ? { ...row, name: event.currentTarget.value } : row))} aria-label={`Revenue stream ${index + 1}`} /></td><td><input value={stream.category} onChange={(event) => setStreams((rows) => rows.map((row, i) => i === index ? { ...row, category: event.currentTarget.value } : row))} aria-label={`Revenue category ${index + 1}`} /></td><td><input type="number" min="0" max="100" value={stream.probability} onChange={(event) => setStreams((rows) => rows.map((row, i) => i === index ? { ...row, probability: Number(event.currentTarget.value) } : row))} aria-label={`Revenue probability ${index + 1}`} /></td>{months.map((month, monthIndex) => <td key={month}><input type="number" min="0" step="0.01" value={stream.monthlyAmounts[monthIndex] ?? 0} onChange={(event) => setStreams((rows) => rows.map((row, i) => i === index ? { ...row, monthlyAmounts: row.monthlyAmounts.map((amount, j) => j === monthIndex ? Number(event.currentTarget.value) : amount) } : row))} aria-label={`${stream.name} ${month} amount`} /></td>)}<td><input type="checkbox" checked={Boolean(stream.id && selectedStreams.includes(stream.id))} onChange={() => stream.id && setSelectedStreams((ids) => ids.includes(stream.id!) ? ids.filter((id) => id !== stream.id) : [...ids, stream.id!])} disabled={!stream.id} aria-label={`Select ${stream.name} for deletion`} /></td></tr>)}</tbody></table>{!streams.length && <p className={styles.emptyInline}>No revenue streams saved. Add a stream to begin.</p>}</div>}
          {kind === "resource" && <div className={styles.tableScroll}><table className={styles.planTable}><thead><tr><th>Role</th><th>Headcount</th><th>Monthly cost</th><th>Allocation %</th><th>Annual plan</th><th /></tr></thead><tbody>{resources.map((row, index) => <tr key={row.id ?? index}><td><input required value={row.role} onChange={(event) => setResources((rows) => rows.map((item, i) => i === index ? { ...item, role: event.currentTarget.value } : item))} /></td><td><input type="number" min="0" step="1" value={row.headcount} onChange={(event) => setResources((rows) => rows.map((item, i) => i === index ? { ...item, headcount: Number(event.currentTarget.value) } : item))} /></td><td><input type="number" min="0" step="0.01" value={row.monthlyCost} onChange={(event) => setResources((rows) => rows.map((item, i) => i === index ? { ...item, monthlyCost: Number(event.currentTarget.value) } : item))} /></td><td><input type="number" min="0" max="100" value={row.allocationPercent} onChange={(event) => setResources((rows) => rows.map((item, i) => i === index ? { ...item, allocationPercent: Number(event.currentTarget.value) } : item))} /></td><td>{formatMoney(row.headcount * row.monthlyCost * 12 * row.allocationPercent / 100)}</td><td><button type="button" className={styles.iconAction} onClick={() => setResources((rows) => rows.filter((_, i) => i !== index))} aria-label={`Remove ${row.role}`}><Trash2 size={14} /></button></td></tr>)}</tbody></table>{!resources.length && <p className={styles.emptyInline}>No resource rows saved.</p>}</div>}
          {kind === "cost" && <div className={styles.tableScroll}><table className={styles.planTable}><thead><tr><th>Category</th><th>Description</th>{months.map((month) => <th key={month}>{month}</th>)}<th /></tr></thead><tbody>{costs.map((row, index) => <tr key={row.id ?? index}><td><input required value={row.category} onChange={(event) => setCosts((rows) => rows.map((item, i) => i === index ? { ...item, category: event.currentTarget.value } : item))} /></td><td><input value={row.description} onChange={(event) => setCosts((rows) => rows.map((item, i) => i === index ? { ...item, description: event.currentTarget.value } : item))} /></td>{months.map((month, monthIndex) => <td key={month}><input type="number" min="0" step="0.01" value={row.monthlyAmounts[monthIndex] ?? 0} onChange={(event) => setCosts((rows) => rows.map((item, i) => i === index ? { ...item, monthlyAmounts: item.monthlyAmounts.map((amount, j) => j === monthIndex ? Number(event.currentTarget.value) : amount) } : item))} aria-label={`${row.category} ${month} amount`} /></td>)}<td><button type="button" className={styles.iconAction} onClick={() => setCosts((rows) => rows.filter((_, i) => i !== index))} aria-label={`Remove ${row.category}`}><Trash2 size={14} /></button></td></tr>)}</tbody></table>{!costs.length && <p className={styles.emptyInline}>No cost rows saved.</p>}</div>}
          <div className={styles.planActions}><button type="button" className={styles.secondaryButton} onClick={() => { if (kind === "revenue") setStreams((rows) => [...rows, { name: "", category: "", monthlyAmounts: Array(12).fill(0), probability: 100 }]); if (kind === "resource") setResources((rows) => [...rows, { role: "", headcount: 0, monthlyCost: 0, allocationPercent: 100 }]); if (kind === "cost") setCosts((rows) => [...rows, { category: "", description: "", monthlyAmounts: Array(12).fill(0) }]); }}><Plus size={15} /> Add row</button><button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? "Saving…" : "Save plan"}</button></div>
        </form>
      )}
      {kind === "revenue" && streams.length > 0 && (<div className={styles.deleteStreams}>{selectedStreams.length > 0 && (<form onSubmit={deleteSelectedStreams}>{otpRequested && <label>Deletion code <input value={otp} onChange={(event) => setOtp(event.currentTarget.value)} required /></label>}<button type={otpRequested ? "submit" : "button"} className={styles.dangerButton} onClick={() => !otpRequested && void requestDeletionCode()}>{otpRequested ? "Confirm deletion" : `Request deletion code (${selectedStreams.length} selected)`}</button></form>)}<span>Stream deletion requires an emailed one-time code.</span></div>)}
    </section>
  );
}

function ForecastResult({ data }: { data: unknown }) { const record = recordOf(data); const forecast = recordOf(record?.forecast); if (!forecast) return <div className={styles.integrationState}><CircleAlert size={21} /><h2>AI forecast is not configured</h2><p>The API returned no forecast payload. Configure the approved AI provider before this view can generate predictions.</p></div>; return <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Provider forecast</h2><p>Forecast supplied by the configured AI integration.</p></div></div><pre className={styles.jsonOutput}>{JSON.stringify(forecast, null, 2)}</pre></section>; }

function AccountingWorkspace({ data, tab, onTab, admin, disabled, refresh, page, onPage }: { data: Record<string, unknown>; tab: "journals" | "eliminations" | "credit-notes" | "settings"; onTab: (tab: "journals" | "eliminations" | "credit-notes" | "settings") => void; admin: boolean; disabled: boolean; refresh: () => void; page: number; onPage: (page: number) => void; }) {
  const tabs = ["journals", "eliminations", "credit-notes", "settings"] as const;
  const [showForm, setShowForm] = useState(false); const [busyId, setBusyId] = useState("");
  const [settingsOverrides, setSettingsOverrides] = useState<Partial<Record<"currency" | "taxRate" | "paymentTermsDays" | "invoicePrefix" | "nextInvoiceNumber", string>>>({});
  const settingsResponse = recordOf(data.settings); const settingsValues = recordOf(settingsResponse?.settings);
  const settings = { currency: settingsOverrides.currency ?? String(settingsValues?.currency ?? "INR"), taxRate: settingsOverrides.taxRate ?? String(settingsValues?.taxRate ?? 18), paymentTermsDays: settingsOverrides.paymentTermsDays ?? String(settingsValues?.paymentTermsDays ?? 30), invoicePrefix: settingsOverrides.invoicePrefix ?? String(settingsValues?.invoicePrefix ?? "INV"), nextInvoiceNumber: settingsOverrides.nextInvoiceNumber ?? String(settingsValues?.nextInvoiceNumber ?? 1) };
  const response = recordOf(data[tab]); const items = Array.isArray(response?.items) ? response.items as Array<Record<string, unknown>> : [];
  const total = Number(response?.total ?? items.length); const limit = Number(response?.limit ?? 20); const totalPages = Math.max(1, Math.ceil(total / limit));
  async function decide(id: string, decision: "approved" | "rejected") { setBusyId(id); try { await FinanceService.decideElimination(id, decision, ""); toast.success(`Elimination ${decision}.`); refresh(); } catch (error) { toast.error(apiMessage(error)); } finally { setBusyId(""); } }
  async function saveSettings(event: FormEvent<HTMLFormElement>) { event.preventDefault(); try { await FinanceService.saveSettings({ currency: settings.currency, taxRate: Number(settings.taxRate), paymentTermsDays: Number(settings.paymentTermsDays), invoicePrefix: settings.invoicePrefix, nextInvoiceNumber: Number(settings.nextInvoiceNumber) }); toast.success("Billing settings saved."); setSettingsOverrides({}); refresh(); } catch (error) { toast.error(apiMessage(error)); } }
  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label="Accounting sections">{tabs.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? styles.tabActive : styles.tab} onClick={() => onTab(item)}>{item.replace("-", " ").replace(/^\w/, (letter) => letter.toUpperCase())}</button>)}</div>
      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>{tab === "credit-notes" ? "Credit notes" : tab === "settings" ? "Billing settings" : tab[0].toUpperCase() + tab.slice(1)}</h2><p>Accounting actions are restricted to administrators.</p></div>{!disabled && (tab === "eliminations" || admin && tab === "journals") && <button className={styles.primaryButton} type="button" onClick={() => setShowForm((open) => !open)}><Plus size={15} /> New {tab === "journals" ? "journal" : "request"}</button>}</div>
        {tab === "settings" ? (admin ? <form className={styles.settingsForm} onSubmit={saveSettings}>{(["currency", "taxRate", "paymentTermsDays", "invoicePrefix", "nextInvoiceNumber"] as const).map((field) => <label key={field}>{field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}<input value={settings[field]} onChange={(event) => setSettingsOverrides((current) => ({ ...current, [field]: event.currentTarget.value }))} required /></label>)}<button className={styles.primaryButton} type="submit">Save settings</button></form> : <div className={styles.emptyNotice}>Billing settings can only be changed by an administrator.</div>) : tab === "journals" && !admin ? <div className={styles.emptyNotice}>Journal access is restricted to administrators.</div> : (
          <div className={styles.tableScroll}><table className={styles.dataTable}><thead><tr>{tab === "journals" ? <><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Amount</th></> : tab === "eliminations" ? <><th>Title</th><th>Amount</th><th>Status</th><th>Decision</th></> : <><th>Credit note</th><th>Invoice</th><th>Reason</th><th>Amount</th></>}</tr></thead><tbody>{items.map((item) => { const id = String(item._id ?? ""); return (<tr key={id}>{tab === "journals" ? (<><td>{item.entryDate ? new Date(String(item.entryDate)).toLocaleDateString() : "—"}</td><td>{String(item.description ?? "")}</td><td>{String(item.debitAccount ?? "")}</td><td>{String(item.creditAccount ?? "")}</td><td>{formatMoney(Number(item.amount ?? 0))}</td></>) : tab === "eliminations" ? (<><td>{String(item.title ?? "")}</td><td>{formatMoney(Number(item.amount ?? 0))}</td><td><StatusBadge status={String(item.status ?? "")} /></td><td>{admin && item.status === "pending" ? <span className={styles.inlineActions}><button type="button" onClick={() => void decide(id, "approved")} disabled={busyId === id}>Approve</button><button type="button" onClick={() => void decide(id, "rejected")} disabled={busyId === id}>Reject</button></span> : String(item.decisionNote ?? "—")}</td></>) : (<><td>{String(item.number ?? "")}</td><td>{String(item.invoiceId ?? "")}</td><td>{String(item.reason ?? "")}</td><td>{formatMoney(Number(item.amount ?? 0))}</td></>)}</tr>); })}{!items.length && <tr><td className={styles.emptyCell} colSpan={5}>No records were returned.</td></tr>}</tbody></table></div>
        )}
        {showForm && (tab === "journals" || tab === "eliminations") && <AccountingForm kind={tab} disabled={disabled || !admin && tab === "journals"} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refresh(); }} />}
        {tab !== "settings" && <Pagination page={page} totalPages={totalPages} onPage={onPage} />}
      </section>
    </>
  );
}

function AccountingForm({ kind, disabled, onClose, onSaved }: { kind: "journals" | "eliminations"; disabled: boolean; onClose: () => void; onSaved: () => void; }) {
  const [values, setValues] = useState<Record<string, string>>(kind === "journals" ? { entryDate: "", description: "", debitAccount: "", creditAccount: "", amount: "", reference: "" } : { title: "", description: "", amount: "" });
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); try { const input = { ...values, amount: Number(values.amount) }; if (kind === "journals") await FinanceService.createJournal(input); else await FinanceService.createElimination(input); toast.success(kind === "journals" ? "Journal recorded." : "Elimination request submitted."); onSaved(); } catch (error) { toast.error(apiMessage(error)); } finally { setSaving(false); } }
  const fields = kind === "journals" ? ["entryDate", "description", "debitAccount", "creditAccount", "amount", "reference"] : ["title", "description", "amount"];
  return <form className={styles.inlineForm} onSubmit={submit}><div className={styles.formGrid}>{fields.map((field) => <label key={field}>{field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}<input type={field === "entryDate" ? "date" : field === "amount" ? "number" : "text"} min={field === "amount" ? "0.01" : undefined} step={field === "amount" ? "0.01" : undefined} value={values[field]} onChange={(event) => setValues((current) => ({ ...current, [field]: event.currentTarget.value }))} required={field !== "reference"} /></label>)}</div>{disabled && <p className={styles.formWarning}>Select one franchise and use an administrator account to continue.</p>}<div className={styles.formActions}><button className={styles.secondaryButton} type="button" onClick={onClose}>Cancel</button><button className={styles.primaryButton} type="submit" disabled={saving || disabled}>{saving ? "Saving…" : "Submit"}</button></div></form>;
}

function InvoiceList({ data, page, onPage }: { data: FinanceList<FinanceInvoice>; page: number; onPage: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
  return <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Invoice register</h2><p>{data.total} invoice records</p></div></div><InvoiceTable items={data.items} /><Pagination page={page} totalPages={totalPages} onPage={onPage} /></section>;
}

function InvoiceTable({ items }: { items: FinanceInvoice[] }) {
  return <div className={styles.tableScroll}><table className={styles.dataTable}><thead><tr><th>Invoice</th><th>Customer</th><th>Issue date</th><th>Due date</th><th>Total</th><th>Paid</th><th>Status</th><th /></tr></thead><tbody>{items.map((invoice) => (<tr key={invoice._id}><td><Link className={styles.tableLink} href={`/dashboard/finance/billing/invoices/${invoice._id}`}>{invoice.invoiceNumber}</Link></td><td>{invoice.customer?.name ?? "—"}</td><td>{new Date(invoice.createdAt).toLocaleDateString()}</td><td>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "—"}</td><td>{formatMoney(invoice.total, invoice.currency)}</td><td>{formatMoney(invoice.paidAmount, invoice.currency)}</td><td><StatusBadge status={invoice.status} /></td><td><Link className={styles.viewLink} href={`/dashboard/finance/billing/invoices/${invoice._id}`}>Open <ArrowUpRight size={13} /></Link></td></tr>))}{!items.length && <tr><td className={styles.emptyCell} colSpan={8}>No invoices match the current filters.</td></tr>}</tbody></table></div>;
}

function InvoiceDetail({ invoice, admin, onBack, onRefresh }: { invoice: FinanceInvoice | null; admin: boolean; onBack: () => void; onRefresh: () => void; }) {
  const [busy, setBusy] = useState(false); const [email, setEmail] = useState(""); const [creditAmount, setCreditAmount] = useState(""); const [creditReason, setCreditReason] = useState(""); const [editing, setEditing] = useState(false);
  if (!invoice) return <div className={styles.emptyNotice}>Invoice was not returned by the API.</div>;
  const invoiceId = invoice._id; const invoiceNumber = invoice.invoiceNumber;
  async function run(action: () => Promise<unknown>, success: string) { setBusy(true); try { await action(); toast.success(success); onRefresh(); } catch (error) { toast.error(apiMessage(error)); } finally { setBusy(false); } }
  async function downloadPdf() { await run(async () => { const blob = await FinanceService.invoicePdf(invoiceId); downloadBlob(blob, `${invoiceNumber}.pdf`); }, "Invoice PDF downloaded."); }
  async function createCreditNote(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await run(() => FinanceService.createCreditNote(invoiceId, { amount: Number(creditAmount), reason: creditReason }), "Credit note created."); setCreditAmount(""); setCreditReason(""); }
  return (
    <>
      <button type="button" className={styles.backButton} onClick={onBack}><ArrowLeft size={15} /> Back to invoices</button>
      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>{invoice.invoiceNumber}</h2><p>{invoice.customer?.name} · Created {new Date(invoice.createdAt).toLocaleDateString()}</p></div><StatusBadge status={invoice.status} /></div>
        <div className={styles.detailGrid}><Detail label="Customer" value={invoice.customer?.name ?? "—"} /><Detail label="Email" value={invoice.customer?.email || "—"} /><Detail label="Due date" value={invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "—"} /><Detail label="Currency" value={invoice.currency} /><Detail label="Subtotal" value={formatMoney(invoice.subtotal, invoice.currency)} /><Detail label="Tax" value={formatMoney(invoice.taxAmount, invoice.currency)} /><Detail label="Total" value={formatMoney(invoice.total, invoice.currency)} /><Detail label="Paid" value={formatMoney(invoice.paidAmount, invoice.currency)} /><Detail label="Outstanding" value={formatMoney(Math.max(0, invoice.total - invoice.paidAmount), invoice.currency)} /></div>
        <div className={styles.tableScroll}><table className={styles.dataTable}><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Tax</th><th>Amount</th></tr></thead><tbody>{invoice.lineItems.map((item, index) => <tr key={`${item.description}-${index}`}><td>{item.description}</td><td>{item.quantity}</td><td>{formatMoney(item.unitPrice, invoice.currency)}</td><td>{item.taxRate}%</td><td>{formatMoney(item.amount, invoice.currency)}</td></tr>)}</tbody></table></div>
        {invoice.paymentLinkUrl && <p className={styles.infoBanner}>Payment link <a href={invoice.paymentLinkUrl} target="_blank" rel="noreferrer">{invoice.paymentLinkUrl}</a></p>}
        <div className={styles.actionBar}>
          {invoice.status === "draft" && <button type="button" className={styles.secondaryButton} onClick={() => setEditing(true)}>Edit draft</button>}
          <button type="button" className={styles.secondaryButton} onClick={() => void downloadPdf()} disabled={busy}><ArrowDownToLine size={15} /> Download PDF</button>
          <button type="button" className={styles.secondaryButton} onClick={() => void run(() => FinanceService.emailInvoice(invoice._id, email || undefined), "Invoice email sent.")} disabled={busy}><ArrowUpRight size={15} /> Send email</button>
          <input className={styles.inlineInput} type="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} placeholder={invoice.customer?.email || "Recipient email"} aria-label="Invoice recipient email" />
          <button type="button" className={styles.secondaryButton} onClick={() => void run(() => FinanceService.createPaymentLink(invoice._id), "Payment link created.")} disabled={busy}><ArrowUpRight size={15} /> Payment link</button>
          {admin && invoice.status === "draft" && <button type="button" className={styles.primaryButton} onClick={() => void run(() => FinanceService.invoiceAction(invoice._id, "issue"), "Invoice issued.")} disabled={busy}><Check size={15} /> Issue</button>}
          {admin && !["paid", "cancelled"].includes(invoice.status) && <button type="button" className={styles.dangerButton} onClick={() => window.confirm("Cancel this invoice? This action cannot be undone.") && void run(() => FinanceService.invoiceAction(invoice._id, "cancel"), "Invoice cancelled.")} disabled={busy}>Cancel invoice</button>}
        </div>
        {admin && <form className={styles.inlineForm} onSubmit={createCreditNote}><h3>Create credit note</h3><div className={styles.formGrid}><label>Amount<input type="number" min="0.01" max={invoice.total - invoice.creditedAmount} step="0.01" value={creditAmount} onChange={(event) => setCreditAmount(event.currentTarget.value)} required /></label><label>Reason<input value={creditReason} onChange={(event) => setCreditReason(event.currentTarget.value)} minLength={3} maxLength={1000} required /></label></div><button type="submit" className={styles.secondaryButton} disabled={busy}>Create credit note</button></form>}
      </section>
      {editing && <InvoiceForm initialInvoice={invoice} disabled={false} onClose={() => setEditing(false)} onSave={async (input) => { await FinanceService.updateInvoice(invoiceId, input); toast.success("Invoice draft updated."); setEditing(false); onRefresh(); }} />}
    </>
  );
}

function PaymentList({ data, page, refunds, onPage }: { data: unknown; page: number; refunds: boolean; onPage: (page: number) => void }) {
  const response = recordOf(data); const items = Array.isArray(response?.items) ? response.items as Array<Record<string, unknown>> : [];
  const total = Number(response?.total ?? items.length); const limit = Number(response?.limit ?? 20);
  return <section className={styles.panel}><div className={styles.panelHeader}><div><h2>{refunds ? "Refund records" : "Payment register"}</h2><p>{total} records returned</p></div></div><div className={styles.tableScroll}><table className={styles.dataTable}><thead><tr>{refunds ? <><th>Payment</th><th>Invoice</th><th>Amount</th><th>Reason</th><th>Date</th><th /></> : <><th>Reference</th><th>Invoice</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th /></>}</tr></thead><tbody>{items.map((payment, index) => { if (refunds) { const paymentId = String(payment.paymentId ?? ""); const invoice = recordOf(payment.invoice); const createdAt = String(payment.createdAt ?? ""); return <tr key={`${payment._id ?? paymentId}-${index}`}><td>{paymentId.slice(-8) || "—"}</td><td>{String(invoice?.invoiceNumber ?? "—")}</td><td>{formatMoney(Number(payment.amount ?? 0))}</td><td>{String(payment.reason ?? "—")}</td><td>{createdAt ? new Date(createdAt).toLocaleDateString() : "—"}</td><td>{paymentId && <Link className={styles.viewLink} href={`/dashboard/finance/billing/payments/${paymentId}`}>Open <ArrowUpRight size={13} /></Link>}</td></tr>; } const id = String(payment._id ?? ""); const invoice = recordOf(payment.invoiceId); const invoiceNumber = invoice ? invoice.invoiceNumber : payment.invoiceId ?? "—"; return <tr key={id}><td>{String(payment.reference || id.slice(-8))}</td><td>{String(invoiceNumber)}</td><td>{formatMoney(Number(payment.amount ?? 0), String(payment.currency ?? "INR"))}</td><td>{String(payment.method ?? "—")}</td><td><StatusBadge status={String(payment.status ?? "")} /></td><td>{payment.createdAt ? new Date(String(payment.createdAt)).toLocaleDateString() : "—"}</td><td><Link className={styles.viewLink} href={`/dashboard/finance/billing/payments/${id}`}>Open <ArrowUpRight size={13} /></Link></td></tr>; })}{!items.length && <tr><td className={styles.emptyCell} colSpan={refunds ? 6 : 7}>{refunds ? "No refund records were returned." : "No payment records match the current filter."}</td></tr>}</tbody></table></div><Pagination page={page} totalPages={Math.max(1, Math.ceil(total / limit))} onPage={onPage} /></section>;
}

function PaymentDetail({ payment, admin, onBack, onRefresh }: { payment: FinancePayment | null; admin: boolean; onBack: () => void; onRefresh: () => void; }) {
  const [busy, setBusy] = useState(false); const [rejectReason, setRejectReason] = useState(""); const [refundReason, setRefundReason] = useState(""); const [refundAmount, setRefundAmount] = useState(""); const [reversalReason, setReversalReason] = useState("");
  if (!payment) return <div className={styles.emptyNotice}>Payment was not returned by the API.</div>;
  const paymentId = payment._id; const paymentProofName = payment.proof?.fileName;
  const alreadyRefunded = (payment.refunds ?? []).reduce((sum, refund) => sum + refund.amount, 0); const refundable = Math.max(0, payment.amount - alreadyRefunded);
  async function run(action: () => Promise<unknown>, success: string) { setBusy(true); try { await action(); toast.success(success); onRefresh(); } catch (error) { toast.error(apiMessage(error)); } finally { setBusy(false); } }
  async function downloadProof() { await run(async () => { const blob = await FinanceService.paymentProof(paymentId); downloadBlob(blob, paymentProofName || `payment-${paymentId}-proof`); }, "Payment proof downloaded."); }
  async function uploadProof(event: ChangeEvent<HTMLInputElement>) { const file = event.currentTarget.files?.[0]; if (!file) return; const input = event.currentTarget; await run(() => FinanceService.uploadPaymentProof(paymentId, file), "Proof uploaded securely."); input.value = ""; }
  const invoiceId = typeof payment.invoiceId === "object" ? payment.invoiceId._id : payment.invoiceId;
  return (
    <>
      <button type="button" className={styles.backButton} onClick={onBack}><ArrowLeft size={15} /> Back to payments</button>
      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Payment {payment._id.slice(-8)}</h2><p>Created {new Date(payment.createdAt).toLocaleString()}</p></div><StatusBadge status={payment.status} /></div>
        <div className={styles.detailGrid}><Detail label="Amount" value={formatMoney(payment.amount, payment.currency)} /><Detail label="Method" value={payment.method} /><Detail label="Reference" value={payment.reference || "—"} /><Detail label="Invoice" value={typeof payment.invoiceId === "object" ? payment.invoiceId.invoiceNumber : invoiceId ?? "—"} /><Detail label="Proof" value={payment.proof?.fileName || "Not uploaded"} /><Detail label="Rejection reason" value={payment.rejectionReason || "—"} /><Detail label="Refunded" value={formatMoney(alreadyRefunded, payment.currency)} /></div>
        <div className={styles.actionBar}>
          <label className={styles.secondaryButton}><Upload size={15} /> Upload proof<input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => void uploadProof(event)} disabled={busy} hidden /></label>
          {payment.proof?.fileName && <button className={styles.secondaryButton} type="button" onClick={() => void downloadProof()} disabled={busy}><ArrowDownToLine size={15} /> View proof</button>}
          {admin && payment.status === "pending" && <button className={styles.primaryButton} type="button" onClick={() => window.confirm("Verify this payment and apply it to the invoice?") && void run(() => FinanceService.paymentAction(paymentId, "verify"), "Payment verified.")} disabled={busy}><ShieldCheck size={15} /> Verify</button>}
        </div>
        {admin && payment.status === "pending" && <form className={styles.inlineForm} onSubmit={(event) => { event.preventDefault(); if (window.confirm("Reject this payment?")) void run(() => FinanceService.paymentAction(paymentId, "reject", { reason: rejectReason }), "Payment rejected."); }}><h3>Reject payment</h3><div className={styles.formGrid}><label>Reason<input value={rejectReason} onChange={(event) => setRejectReason(event.currentTarget.value)} minLength={3} maxLength={1000} required /></label></div><button className={styles.dangerButton} type="submit" disabled={busy}>Reject</button></form>}
        {admin && payment.status === "verified" && <>
          <form className={styles.inlineForm} onSubmit={(event) => { event.preventDefault(); if (window.confirm("Record a ledger reversal for this payment?")) void run(() => FinanceService.paymentAction(paymentId, "reversals", { reason: reversalReason }), "Ledger reversal recorded."); }}><h3>Record ledger reversal</h3><div className={styles.formGrid}><label>Reason<input value={reversalReason} onChange={(event) => setReversalReason(event.currentTarget.value)} minLength={3} maxLength={1000} required /></label></div><button className={styles.dangerButton} type="submit" disabled={busy}>Reverse payment</button></form>
          <form className={styles.inlineForm} onSubmit={(event) => { event.preventDefault(); if (window.confirm(`Record a refund of ${formatMoney(Number(refundAmount), payment.currency)}?`)) void run(() => FinanceService.paymentAction(paymentId, "refunds", { amount: Number(refundAmount), reason: refundReason }), "Refund recorded."); }}><h3>Record refund</h3><div className={styles.formGrid}><label>Amount<input type="number" min="0.01" max={refundable} step="0.01" value={refundAmount} onChange={(event) => setRefundAmount(event.currentTarget.value)} required disabled={refundable <= 0} /></label><label>Reason<input value={refundReason} onChange={(event) => setRefundReason(event.currentTarget.value)} minLength={3} maxLength={1000} required /></label></div><button className={styles.secondaryButton} type="submit" disabled={busy || refundable <= 0}>Refund</button></form>
        </>}
        {!!payment.refunds?.length && <div className={styles.refundList}><h3>Refunds</h3>{payment.refunds.map((refund) => <p key={`${refund.createdAt}-${refund.amount}`}>{formatMoney(refund.amount, payment.currency)} · {refund.reason} · {new Date(refund.createdAt).toLocaleDateString()}</p>)}</div>}
      </section>
    </>
  );
}

function InvoiceForm({ disabled, initialInvoice, onClose, onSave }: { disabled?: boolean; initialInvoice?: FinanceInvoice; onClose: () => void; onSave: (input: FinanceInvoiceInput) => Promise<void>; }) {
  const [saving, setSaving] = useState(false);
  const [customer, setCustomer] = useState(initialInvoice?.customer ?? { name: "", email: "", phone: "", address: "" });
  const [dueDate, setDueDate] = useState(initialInvoice?.dueDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(initialInvoice?.notes ?? "");
  const [items, setItems] = useState(initialInvoice?.lineItems.map(({ description, quantity, unitPrice, taxRate }) => ({ description, quantity, unitPrice, taxRate })) ?? [{ description: "", quantity: 1, unitPrice: 0, taxRate: 0 }]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); try { await onSave({ customer, lineItems: items, ...(initialInvoice ? { dueDate: dueDate || null } : dueDate ? { dueDate } : {}), notes }); } catch (error) { toast.error(apiMessage(error)); } finally { setSaving(false); } }
  return <div className={styles.modalBackdrop}><section className={styles.formDialog} role="dialog" aria-modal="true" aria-labelledby="new-invoice-title"><div className={styles.panelHeader}><div><h2 id="new-invoice-title">{initialInvoice ? "Edit invoice draft" : "Create invoice draft"}</h2><p>Invoice totals are calculated by the server.</p></div><button className={styles.iconAction} type="button" onClick={onClose} aria-label="Close"><X size={16} /></button></div><form onSubmit={submit}><div className={styles.formGrid}>{(["name", "email", "phone", "address"] as const).map((field) => <label key={field}>Customer {field}<input type={field === "email" ? "email" : "text"} value={customer[field]} onChange={(event) => setCustomer((current) => ({ ...current, [field]: event.currentTarget.value }))} required={field === "name"} /></label>)}<label>Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.currentTarget.value)} /></label><label>Notes<input value={notes} onChange={(event) => setNotes(event.currentTarget.value)} maxLength={2000} /></label></div><h3>Line items</h3>{items.map((item, index) => <div className={styles.invoiceItemRow} key={index}><input placeholder="Description" value={item.description} onChange={(event) => setItems((rows) => rows.map((row, i) => i === index ? { ...row, description: event.currentTarget.value } : row))} required aria-label={`Line item ${index + 1} description`} /><input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => setItems((rows) => rows.map((row, i) => i === index ? { ...row, quantity: Number(event.currentTarget.value) } : row))} aria-label="Quantity" /><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => setItems((rows) => rows.map((row, i) => i === index ? { ...row, unitPrice: Number(event.currentTarget.value) } : row))} aria-label="Unit price" /><input type="number" min="0" max="100" step="0.01" value={item.taxRate} onChange={(event) => setItems((rows) => rows.map((row, i) => i === index ? { ...row, taxRate: Number(event.currentTarget.value) } : row))} aria-label="Tax percentage" /><button type="button" className={styles.iconAction} onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))} disabled={items.length === 1} aria-label="Remove line item"><Trash2 size={14} /></button></div>)}<button type="button" className={styles.textButton} onClick={() => setItems((rows) => [...rows, { description: "", quantity: 1, unitPrice: 0, taxRate: 0 }])}><Plus size={14} /> Add line item</button>{disabled && <p className={styles.formWarning}>Select a franchise in the header before creating an invoice.</p>}<div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button><button type="submit" className={styles.primaryButton} disabled={saving || disabled}>{saving ? "Saving…" : initialInvoice ? "Save changes" : "Create draft"}</button></div></form></section></div>;
}

function PaymentForm({ disabled, onClose, onSave }: { disabled: boolean; onClose: () => void; onSave: (input: FinancePaymentInput) => Promise<void>; }) {
  const [values, setValues] = useState({ invoiceId: "", amount: "", method: "bank_transfer" as FinancePaymentInput["method"], reference: "", note: "" });
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); try { await onSave({ ...values, ...(values.invoiceId ? { invoiceId: values.invoiceId.trim() } : {}), amount: Number(values.amount) }); } catch (error) { toast.error(apiMessage(error)); } finally { setSaving(false); } }
  return <div className={styles.modalBackdrop}><section className={styles.formDialog} role="dialog" aria-modal="true" aria-labelledby="new-payment-title"><div className={styles.panelHeader}><div><h2 id="new-payment-title">Record payment</h2><p>Proof can be attached after the record is created.</p></div><button className={styles.iconAction} type="button" onClick={onClose} aria-label="Close"><X size={16} /></button></div><form onSubmit={submit}><div className={styles.formGrid}><label>Invoice ID (optional)<input value={values.invoiceId} onChange={(event) => setValues((current) => ({ ...current, invoiceId: event.currentTarget.value }))} /></label><label>Amount<input type="number" min="0.01" step="0.01" value={values.amount} onChange={(event) => setValues((current) => ({ ...current, amount: event.currentTarget.value }))} required /></label><label>Method<select value={values.method} onChange={(event) => setValues((current) => ({ ...current, method: event.currentTarget.value as FinancePaymentInput["method"] }))}><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="razorpay">Razorpay</option><option value="other">Other</option></select></label><label>Reference<input value={values.reference} onChange={(event) => setValues((current) => ({ ...current, reference: event.currentTarget.value }))} maxLength={120} /></label><label className={styles.fieldWide}>Note<input value={values.note} onChange={(event) => setValues((current) => ({ ...current, note: event.currentTarget.value }))} maxLength={1000} /></label></div>{disabled && <p className={styles.formWarning}>Select a franchise in the header before recording a payment.</p>}<div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button><button type="submit" className={styles.primaryButton} disabled={saving || disabled}>{saving ? "Saving…" : "Record payment"}</button></div></form></section></div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className={styles.detailItem}><span>{label}</span><strong>{value}</strong></div>; }
function StatusBadge({ status }: { status: string }) { const safe = status.toLowerCase().replace(/[^a-z0-9_-]/g, ""); return <span className={`${styles.statusBadge} ${styles[`status_${safe}`] ?? ""}`}>{status.replaceAll("_", " ") || "Unknown"}</span>; }
function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  return <div className={styles.pagination}><span>Page {page} of {totalPages}</span><div><button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={16} /></button><button type="button" onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} aria-label="Next page"><ChevronRight size={16} /></button></div></div>;
}
