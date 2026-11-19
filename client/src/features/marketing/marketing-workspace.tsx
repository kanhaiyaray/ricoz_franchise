"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleAlert, LoaderCircle, Plus, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useAppSelector } from "@/redux/hooks";
import { MarketingService } from "@/services/marketing.service";
import type { MarketingBlog, MarketingCampaign, MarketingContent, MarketingTask } from "@/services/types/marketing.types";
import styles from "@/features/finance/finance-workspace.module.css";

export type MarketingView = "dashboard" | "work" | "calendar" | "approvals" | "requests" | "campaigns" | "content" | "leads" | "social" | "creative" | "publishing" | "budget" | "attribution" | "analytics" | "reports" | "assistant";

const titles: Record<MarketingView, { title: string; description: string }> = {
  dashboard: { title: "Marketing Dashboard", description: "Campaigns, content, tasks and lead handoffs in the selected scope." },
  work: { title: "My Work", description: "Tasks assigned to your account." },
  calendar: { title: "Marketing Calendar", description: "Scheduled content and upcoming work items." },
  approvals: { title: "Approvals Queue", description: "Campaign review decisions are restricted to administrators." },
  requests: { title: "Department Requests", description: "This workspace has no department-request API endpoint configured." },
  campaigns: { title: "Campaigns", description: "Plan campaign goals, budget, channels and approval state." },
  content: { title: "Content Calendar", description: "Create and schedule reviewable content records." },
  leads: { title: "Lead Generation & Handoff", description: "Send a qualified lead to an active Sales owner." },
  social: { title: "Social Hub", description: "Social account, inbox and publishing providers are not configured." },
  creative: { title: "Creative Studio", description: "Create content and blog drafts for internal review." },
  publishing: { title: "Publishing", description: "Manage schedule and internal publication status; external publishing is unavailable." },
  budget: { title: "Marketing Budget", description: "Budget and reported spend from saved campaign records." },
  attribution: { title: "Attribution", description: "Review Marketing-to-Sales handoffs recorded in the lead system." },
  analytics: { title: "Marketing Analytics", description: "Live aggregates from campaign and content records." },
  reports: { title: "Marketing Reports", description: "Summary reports from available Marketing API data." },
  assistant: { title: "Marketing AI Assistant", description: "AI chat is not available without a configured provider." },
};

type Props = { view: MarketingView; initialQuery: string; initialStatus: string; initialPage: number };
type SalesOwner = { _id: string; name: string; email: string; franchiseId: string };

function objectOf(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function itemsOf<T>(value: unknown): T[] { const record = objectOf(value); return Array.isArray(record?.items) ? record.items as T[] : []; }
function failure(error: unknown) { return error instanceof Error ? error.message : "Marketing request failed."; }
function money(value: unknown) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value ?? 0)); }
function Status({ value }: { value: string }) { const safe = value.toLowerCase().replace(/[^a-z0-9_-]/g, ""); return <span className={`${styles.statusBadge} ${styles[`status_${safe}`] ?? ""}`}>{value.replaceAll("_", " ") || "unknown"}</span>; }

export default function MarketingWorkspace({ view, initialQuery, initialStatus, initialPage }: Props) {
  const pathname = usePathname(); const router = useRouter();
  const user = useAppSelector((state) => state.auth.user); const admin = user?.user_role === "admin";
  const [franchiseId, setFranchiseId] = useState(""); const [query, setQuery] = useState(initialQuery); const [status, setStatus] = useState(initialStatus); const [page, setPage] = useState(initialPage);
  const [refreshToken, setRefreshToken] = useState(0); const [data, setData] = useState<unknown>(null); const [error, setError] = useState(""); const [loadedKey, setLoadedKey] = useState("");
  const [owners, setOwners] = useState<SalesOwner[]>([]);
  const [campaignForm, setCampaignForm] = useState(false); const [contentForm, setContentForm] = useState(false); const [taskForm, setTaskForm] = useState(false); const [handoffForm, setHandoffForm] = useState(false); const [postForm, setPostForm] = useState(false); const [blogForm, setBlogForm] = useState(false);
  const loadKey = [view, query, status, page, refreshToken, franchiseId].join(":");

  useEffect(() => { const updateScope = () => setFranchiseId(window.localStorage.getItem("dashboard-franchise-scope") ?? ""); updateScope(); window.addEventListener("dashboard-scope-change", updateScope); return () => window.removeEventListener("dashboard-scope-change", updateScope); }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        let result: unknown;
        const params = { q: query || undefined, status: status || undefined, page, limit: 20 };
        if (["dashboard", "analytics", "reports", "attribution"].includes(view)) result = await MarketingService.dashboard();
        else if (["campaigns", "budget", "approvals"].includes(view)) result = await MarketingService.campaigns({ ...params, ...(view === "approvals" ? { status: "pending_review" } : {}) });
        else if (["content", "calendar", "publishing"].includes(view)) result = await MarketingService.content({ ...params, ...(view === "publishing" ? { status: "scheduled" } : {}) });
        else if (view === "creative") { const [content, blogs] = await Promise.all([MarketingService.content(params), MarketingService.blogs(params)]); result = { content, blogs }; }
        else if (view === "work") result = await MarketingService.tasks(params);
        else if (view === "leads") { result = await MarketingService.salesOwners(); if (active) setOwners(itemsOf<SalesOwner>(result)); }
        else if (view === "social") result = await Promise.allSettled([MarketingService.socialAccounts(), MarketingService.socialPosts(params), MarketingService.socialInbox()]);
        else if (view === "assistant") result = { available: false, message: "No Marketing assistant endpoint/provider is configured for this deployment." };
        else if (view === "requests") result = null;
        if (active) { setData(result ?? null); setError(""); setLoadedKey(loadKey); }
      } catch (caughtError) { if (active) { setError(failure(caughtError)); setLoadedKey(loadKey); } }
    }
    void load();
    return () => { active = false; };
  }, [franchiseId, loadKey, page, query, refreshToken, status, view]);

  function updateUrl(values: Record<string, string | undefined>) { const params = new URLSearchParams(window.location.search); for (const [key, value] of Object.entries(values)) { if (value) params.set(key, value); else params.delete(key); } const v = params.toString(); router.replace(v ? `${pathname}?${v}` : pathname, { scroll: false }); }
  function search(value: string) { setQuery(value); setPage(1); updateUrl({ q: value || undefined, page: undefined }); }
  function filterStatus(value: string) { setStatus(value); setPage(1); updateUrl({ status: value || undefined, page: undefined }); }
  function pageTo(value: number) { setPage(value); updateUrl({ page: value === 1 ? undefined : String(value) }); }
  function refresh() { setRefreshToken((value) => value + 1); }

  const title = titles[view]; const loading = loadedKey !== loadKey;
  const showSearch = ["campaigns", "approvals", "content", "calendar", "publishing", "creative", "work", "budget"].includes(view);
  const showStatusFilter = showSearch && !["approvals", "publishing"].includes(view);
  const needsFranchiseSelection = admin && !franchiseId;
  const canHandoff = admin && !needsFranchiseSelection;

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div><p className={styles.eyebrow}>MARKETING WORKSPACE</p><h1>{title.title}</h1><p>{title.description}</p></div>
        <div className={styles.headerActions}>
          {["campaigns", "budget"].includes(view) && <button className={styles.primaryButton} type="button" disabled={needsFranchiseSelection} onClick={() => setCampaignForm(true)}><Plus size={15} /> New campaign</button>}
          {["content", "creative", "calendar"].includes(view) && <button className={styles.primaryButton} type="button" disabled={needsFranchiseSelection} onClick={() => setContentForm(true)}><Plus size={15} /> New content</button>}
          {view === "work" && <button className={styles.primaryButton} type="button" disabled={needsFranchiseSelection} onClick={() => setTaskForm(true)}><Plus size={15} /> New task</button>}
          {view === "leads" && canHandoff && <button className={styles.primaryButton} type="button" onClick={() => setHandoffForm(true)}><Plus size={15} /> New handoff</button>}
          {view === "social" && <button className={styles.secondaryButton} type="button" disabled={needsFranchiseSelection} onClick={() => setPostForm(true)}><Plus size={15} /> Save social draft</button>}
          {view === "creative" && <button className={styles.secondaryButton} type="button" disabled={needsFranchiseSelection} onClick={() => setBlogForm(true)}><Plus size={15} /> New blog</button>}
          <button className={styles.secondaryButton} type="button" onClick={refresh}><RefreshCw size={15} /> Refresh</button>
        </div>
      </header>
      {needsFranchiseSelection && <div className={styles.infoBanner}><CircleAlert size={16} /> Select a franchise in the workspace header before creating new Marketing records.</div>}
      {showSearch && <div className={styles.filters}><label className={styles.searchBox}><Search size={15} /><input value={query} onChange={(event) => search(event.currentTarget.value)} placeholder="Search records..." aria-label="Search Marketing records" /></label>{showStatusFilter && <select className={styles.filterSelect} value={status} onChange={(event) => filterStatus(event.currentTarget.value)} aria-label="Filter by status"><option value="">All statuses</option>{["draft", "pending_review", "approved", "rejected", "active", "completed", "scheduled", "published", "needs_review", "open"].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>}</div>}
      {error && loadedKey === loadKey && <div className={styles.errorPanel} role="alert"><CircleAlert size={18} /><div><strong>Marketing data could not be loaded</strong><p>{error}</p></div><button className={styles.secondaryButton} type="button" onClick={refresh}>Retry</button></div>}
      {loading ? <div className={styles.loadingPanel} role="status"><LoaderCircle className={styles.spinner} size={22} />Loading Marketing data…</div> : !error && (
        <>
          {["dashboard", "analytics", "reports", "attribution"].includes(view) && <MarketingDashboard data={objectOf(data) ?? {}} view={view} />}
          {["campaigns", "approvals", "budget"].includes(view) && <CampaignList data={data} view={view} admin={admin} page={page} onPage={pageTo} refresh={refresh} />}
          {["content", "calendar", "publishing"].includes(view) && <ContentList data={data} view={view} admin={admin} page={page} onPage={pageTo} refresh={refresh} />}
          {view === "creative" && <CreativeWorkspace data={objectOf(data) ?? {}} admin={admin} refresh={refresh} />}
          {view === "work" && <MarketingTasks data={data} page={page} onPage={pageTo} refresh={refresh} />}
          {view === "leads" && <HandoffPanel owners={owners} admin={admin} disabled={needsFranchiseSelection} />}
          {view === "social" && <SocialHub results={Array.isArray(data) ? data : []} onCreateDraft={() => setPostForm(true)} />}
          {view === "requests" && <Unavailable title="Department requests are not connected" message="The supplied Marketing API inventory does not include a department-request endpoint. No placeholder requests are shown." />}
          {view === "assistant" && <Unavailable title="Marketing AI is not configured" message={String(objectOf(data)?.message ?? "No Marketing assistant endpoint/provider is available.")} />}
        </>
      )}
      {campaignForm && <CampaignForm onClose={() => setCampaignForm(false)} onSave={async (input) => { await MarketingService.createCampaign(input); toast.success("Campaign draft created."); setCampaignForm(false); refresh(); }} />}
      {contentForm && <ContentForm admin={admin} onClose={() => setContentForm(false)} onSave={async (input) => { await MarketingService.createContent(input); toast.success("Content record created."); setContentForm(false); refresh(); }} />}
      {taskForm && <TaskForm onClose={() => setTaskForm(false)} onSave={async (input) => { await MarketingService.createTask(input); toast.success("Marketing task created."); setTaskForm(false); refresh(); }} />}
      {handoffForm && <HandoffModal owners={owners} admin={admin} onClose={() => setHandoffForm(false)} onSave={async (input) => { await MarketingService.handoff(input); toast.success("Lead handed off to Sales."); setHandoffForm(false); refresh(); }} />}
      {postForm && <SocialDraftForm onClose={() => setPostForm(false)} onSave={async (input) => { await MarketingService.createSocialPost(input); toast.success("Local social draft saved. Nothing was published."); setPostForm(false); refresh(); }} />}
      {blogForm && <BlogForm onClose={() => setBlogForm(false)} onSave={async (input) => { await MarketingService.createBlog(input); toast.success("Blog draft created."); setBlogForm(false); refresh(); }} />}
    </section>
  );
}

function MarketingDashboard({ data, view }: { data: Record<string, unknown>; view: MarketingView }) {
  const metrics = objectOf(data.metrics) ?? {};
  return (
    <>
      <div className={styles.metricGrid}><Metric label="Campaigns" value={metrics.campaignCount} /><Metric label="Active" value={metrics.activeCampaigns} tone="success" /><Metric label="Awaiting approval" value={metrics.pendingApprovals} tone="warning" /><Metric label="Open tasks" value={metrics.openTasks} /></div>
      <div className={styles.contentGrid}>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>{view === "budget" ? "Budget use" : "Campaign budget"}</h2><p>Totals from saved campaign records</p></div></div><div className={styles.quickStats}><span><strong>{money(metrics.budget)}</strong><small>Planned budget</small></span><span><strong>{money(metrics.spent)}</strong><small>Recorded spend</small></span><span><strong>{money(Number(metrics.budget ?? 0) - Number(metrics.spent ?? 0))}</strong><small>Remaining</small></span></div></section>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Content and handoffs</h2><p>Current API-backed activity</p></div></div><div className={styles.quickStats}><span><strong>{String(metrics.contentInReview ?? 0)}</strong><small>Non-draft content</small></span><span><strong>{String(metrics.handedOffLeads ?? 0)}</strong><small>Marketing leads handed off</small></span></div></section>
      </div>
      {view === "attribution" && <div className={styles.infoBanner}><CircleAlert size={16} /> Attribution by conversion value is unavailable; the API currently reports only lead handoff counts.</div>}
      {view === "reports" && <div className={styles.infoBanner}>This report reflects API-provided totals only; channel conversion attribution is not configured.</div>}
      {view === "dashboard" && <UpcomingTasks items={Array.isArray(data.upcomingTasks) ? data.upcomingTasks as MarketingTask[] : []} />}
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: unknown; tone?: "success" | "warning" }) { return <article className={`${styles.metricCard} ${tone ? styles[`metric${tone}`] : ""}`}><span>{label}</span><strong>{String(value ?? 0)}</strong></article>; }

function CampaignList({ data, view, admin, page, onPage, refresh }: { data: unknown; view: MarketingView; admin: boolean; page: number; onPage: (page: number) => void; refresh: () => void }) {
  const response = objectOf(data); const items = Array.isArray(response?.items) ? response.items as MarketingCampaign[] : [];
  const total = Number(response?.total ?? 0); const limit = Number(response?.limit ?? 20);
  const [notes, setNotes] = useState<Record<string, string>>({});
  async function action(fn: () => Promise<unknown>, success: string) { try { await fn(); toast.success(success); refresh(); } catch (error) { toast.error(failure(error)); } }
  return <section className={styles.panel}><div className={styles.panelHeader}><div><h2>{view === "budget" ? "Campaign budgets" : view === "approvals" ? "Campaign review queue" : "Campaign register"}</h2><p>{total} campaign records</p></div></div><div className={styles.tableScroll}><table className={styles.dataTable}><thead><tr><th>Campaign</th><th>Objective</th><th>Channels</th><th>Budget</th><th>Spent</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item._id}><td>{item.name}</td><td>{item.objective || "—"}</td><td>{item.channels.join(", ") || "—"}</td><td>{money(item.budget)}</td><td>{money(item.spent)}</td><td><Status value={item.status} />{item.reviewNote && <small className={styles.rowDescription}>{item.reviewNote}</small>}</td><td><div className={styles.approvalActions}>{view !== "approvals" && ["draft", "rejected"].includes(item.status) && <button type="button" onClick={() => void action(() => MarketingService.submitCampaign(item._id), "Campaign submitted for review.")}>Submit</button>}{admin && item.status === "pending_review" && <><input value={notes[item._id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item._id]: event.currentTarget.value }))} placeholder="Review note" /><button type="button" onClick={() => void action(() => MarketingService.reviewCampaign(item._id, "approved", notes[item._id] ?? ""), "Campaign approved.")}>Approve</button><button type="button" onClick={() => void action(() => MarketingService.reviewCampaign(item._id, "rejected", notes[item._id] ?? ""), "Campaign rejected.")}>Reject</button></>}{admin && item.status === "approved" && <button type="button" onClick={() => void action(() => MarketingService.updateCampaign(item._id, { status: "active" }), "Campaign marked active.")}>Activate</button>}{admin && item.status === "active" && <button type="button" onClick={() => void action(() => MarketingService.updateCampaign(item._id, { status: "completed" }), "Campaign marked completed.")}>Complete</button>}</div></td></tr>)}{!items.length && <tr><td className={styles.emptyCell} colSpan={7}>{view === "approvals" ? "No campaigns are waiting for review." : "No campaigns match the current filters."}</td></tr>}</tbody></table></div><Pagination page={page} pages={Math.max(1, Math.ceil(total / limit))} onPage={onPage} /></section>;
}

function ContentList({ data, view, admin, page, onPage, refresh }: { data: unknown; view: MarketingView; admin: boolean; page: number; onPage: (page: number) => void; refresh: () => void }) {
  const response = objectOf(data); const items = Array.isArray(response?.items) ? response.items as MarketingContent[] : [];
  const total = Number(response?.total ?? 0); const limit = Number(response?.limit ?? 20);
  async function update(item: MarketingContent, status: MarketingContent["status"]) { try { await MarketingService.updateContent(item._id, { status }); toast.success(status === "published" ? "Internal content status updated; no external post was published." : "Content status updated."); refresh(); } catch (error) { toast.error(failure(error)); } }
  return <section className={styles.panel}>{view === "publishing" && <div className={styles.infoBanner}><CircleAlert size={16} /> Social provider publishing is unavailable. Actions below update only internal content records.</div>}<div className={styles.panelHeader}><div><h2>{view === "calendar" ? "Scheduled content" : view === "publishing" ? "Publishing queue" : "Content records"}</h2><p>{total} content items</p></div></div><div className={styles.tableScroll}><table className={styles.dataTable}><thead><tr><th>Title</th><th>Type</th><th>Channel</th><th>Scheduled</th><th>Status</th><th>Action</th></tr></thead><tbody>{items.map((item) => <tr key={item._id}><td>{item.title}<small className={styles.rowDescription}>{item.body}</small></td><td>{item.type}</td><td>{item.channel || "—"}</td><td>{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : "—"}</td><td><Status value={item.status} /></td><td><div className={styles.approvalActions}>{!["needs_review", "published"].includes(item.status) && <button type="button" onClick={() => void update(item, "needs_review")}>Submit review</button>}{admin && item.status === "needs_review" && <><button type="button" onClick={() => void update(item, "published")}>Mark published</button><button type="button" onClick={() => void update(item, "rejected")}>Reject</button></>}{item.status === "scheduled" && <button type="button" onClick={() => void update(item, "draft")}>Unschedule</button>}</div></td></tr>)}{!items.length && <tr><td className={styles.emptyCell} colSpan={6}>No content records match the current filters.</td></tr>}</tbody></table></div><Pagination page={page} pages={Math.max(1, Math.ceil(total / limit))} onPage={onPage} /></section>;
}

function CreativeWorkspace({ data, admin, refresh }: { data: Record<string, unknown>; admin: boolean; refresh: () => void }) {
  const contentResponse = objectOf(data.content); const blogResponse = objectOf(data.blogs);
  const content = Array.isArray(contentResponse?.items) ? contentResponse.items as MarketingContent[] : [];
  const blogs = Array.isArray(blogResponse?.items) ? blogResponse.items as MarketingBlog[] : [];
  return <div className={styles.contentGrid}><section className={styles.panel}><div className={styles.panelHeader}><div><h2>Content drafts</h2><p>Content items and review states</p></div></div>{content.map((item) => <p className={styles.taskLine} key={item._id}>{item.title} · <Status value={item.status} /></p>)}{!content.length && <p className={styles.emptyInline}>No content drafts exist.</p>}</section><section className={styles.panel}><div className={styles.panelHeader}><div><h2>Blog drafts</h2><p>Published state requires administrator permission</p></div></div>{blogs.map((blog) => <div className={styles.blogRow} key={blog._id}><div><strong>{blog.title}</strong><small>/{blog.slug} · {blog.status}</small></div>{admin && blog.status === "draft" && <button type="button" onClick={async () => { try { await MarketingService.updateBlog(blog._id, { status: "published" }); toast.success("Blog marked published."); refresh(); } catch (error) { toast.error(failure(error)); } }}>Publish record</button>}</div>)}{!blogs.length && <p className={styles.emptyInline}>No blog records exist.</p>}</section></div>;
}

function MarketingTasks({ data, page, onPage, refresh }: { data: unknown; page: number; onPage: (page: number) => void; refresh: () => void }) {
  const response = objectOf(data); const items = Array.isArray(response?.items) ? response.items as MarketingTask[] : [];
  const total = Number(response?.total ?? 0); const limit = Number(response?.limit ?? 20);
  return <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Assigned tasks</h2><p>{total} task records</p></div></div><div className={styles.tableScroll}><table className={styles.dataTable}><thead><tr><th>Task</th><th>Description</th><th>Due</th><th>Status</th><th /></tr></thead><tbody>{items.map((task) => <tr key={task._id}><td>{task.title}</td><td>{task.description || "—"}</td><td>{task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "—"}</td><td><Status value={task.status} /></td><td>{task.status === "open" && <button className={styles.textButton} type="button" onClick={async () => { try { await MarketingService.completeTask(task._id); toast.success("Task completed."); refresh(); } catch (error) { toast.error(failure(error)); } }}>Complete</button>}</td></tr>)}{!items.length && <tr><td className={styles.emptyCell} colSpan={5}>No tasks have been assigned to you.</td></tr>}</tbody></table></div><Pagination page={page} pages={Math.max(1, Math.ceil(total / limit))} onPage={onPage} /></section>;
}

function HandoffPanel({ owners, admin, disabled }: { owners: SalesOwner[]; admin: boolean; disabled: boolean }) {
  return <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Sales handoff</h2><p>Lead ownership transfer is administrator-only and franchise-scoped.</p></div></div>{admin && !disabled ? <div className={styles.infoBanner}><CircleAlert size={16} /> Use the "New handoff" button above to create a handoff.</div> : <div className={styles.infoBanner}><CircleAlert size={16} />{admin ? "Select a franchise in the header to hand off a lead." : "Ask an administrator to create and assign the Sales handoff."}</div>}{owners.length > 0 && <div className={styles.integrationRows}>{owners.slice(0, 8).map((owner) => <article key={owner._id}><div><h3>{owner.name}</h3><p>{owner.email}</p></div><Status value="available" /></article>)}</div>}</section>;
}

function HandoffModal({ owners, admin, onClose, onSave }: { owners: SalesOwner[]; admin: boolean; onClose: () => void; onSave: (input: Record<string, unknown>) => Promise<void> }) {
  return <Dialog title="New Sales handoff" onClose={onClose}>{admin ? <HandoffForm owners={owners} onSubmit={onSave} /> : <p className={styles.formWarning}>Only administrators can assign Sales owners.</p>}</Dialog>;
}

function HandoffForm({ owners, onSubmit }: { owners: SalesOwner[]; onSubmit: (input: Record<string, unknown>) => Promise<void> }) {
  const [values, setValues] = useState({ name: "", email: "", phone: "", company: "", source: "marketing", notes: "", ownerId: "" });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); try { await onSubmit(values); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); } }
  return <form className={styles.formGrid} onSubmit={submit}>{(["name", "email", "phone", "company", "source", "notes"] as const).map((field) => <label key={field}>{field}<input type={field === "email" ? "email" : "text"} value={values[field]} onChange={(event) => setValues((current) => ({ ...current, [field]: event.currentTarget.value }))} required={field === "name"} /></label>)}<label>Sales owner<select value={values.ownerId} onChange={(event) => setValues((current) => ({ ...current, ownerId: event.currentTarget.value }))} required><option value="">Select owner</option>{owners.map((owner) => <option key={owner._id} value={owner._id}>{owner.name} · {owner.email}</option>)}</select></label><div className={styles.formActions}><button type="submit" className={styles.primaryButton} disabled={busy || !owners.length}>{busy ? "Sending…" : "Hand off lead"}</button></div>{!owners.length && <p className={styles.formWarning}>No active Sales owners are available in the selected franchise.</p>}</form>;
}

function SocialHub({ results, onCreateDraft }: { results: unknown[]; onCreateDraft: () => void }) {
  const accounts = results[0] as PromiseSettledResult<unknown> | undefined; const posts = results[1] as PromiseSettledResult<unknown> | undefined; const inbox = results[2] as PromiseSettledResult<unknown> | undefined;
  const postData = posts?.status === "fulfilled" ? objectOf(posts.value) : null;
  const drafts = Array.isArray(postData?.items) ? postData.items as Array<Record<string, unknown>> : [];
  return <div className={styles.contentGrid}><section className={styles.panel}><div className={styles.panelHeader}><div><h2>Social accounts</h2><p>{accounts?.status === "rejected" ? failure(accounts.reason) : String(objectOf(accounts?.value)?.message ?? "No provider credentials configured.")}</p></div></div><div className={styles.integrationRows}>{["facebook", "instagram", "linkedin"].map((provider) => <article key={provider}><div><h3>{provider}</h3><p>Provider connection unavailable</p></div><Status value="unavailable" /></article>)}</div></section><section className={styles.panel}><div className={styles.panelHeader}><div><h2>Local post drafts</h2><p>No draft is sent to an external provider.</p></div><button className={styles.secondaryButton} type="button" onClick={onCreateDraft}><Plus size={14} /> New draft</button></div>{drafts.map((draft) => <p className={styles.taskLine} key={String(draft._id)}>{String(draft.channel)} · {String(draft.body)} · <Status value={String(draft.status)} /></p>)}{!drafts.length && <p className={styles.emptyInline}>No social post drafts saved.</p>}<div className={styles.infoBanner}><CircleAlert size={16} /> Inbox: {inbox?.status === "rejected" ? failure(inbox.reason) : "provider setup required"}.</div></section></div>;
}

function CampaignForm({ onClose, onSave }: { onClose: () => void; onSave: (input: Record<string, unknown>) => Promise<void> }) {
  const [values, setValues] = useState({ name: "", objective: "", channels: "", budget: "", startDate: "", endDate: "" });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); try { await onSave({ name: values.name, objective: values.objective, channels: values.channels.split(",").map((v) => v.trim()).filter(Boolean), budget: Number(values.budget || 0), ...(values.startDate ? { startDate: values.startDate } : {}), ...(values.endDate ? { endDate: values.endDate } : {}) }); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); } }
  return <Dialog title="New campaign" onClose={onClose}><form className={styles.formGrid} onSubmit={submit}><label>Name<input value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.currentTarget.value }))} required /></label><label>Objective<input value={values.objective} onChange={(event) => setValues((current) => ({ ...current, objective: event.currentTarget.value }))} /></label><label>Channels (comma-separated)<input value={values.channels} onChange={(event) => setValues((current) => ({ ...current, channels: event.currentTarget.value }))} /></label><label>Budget<input type="number" min="0" step="0.01" value={values.budget} onChange={(event) => setValues((current) => ({ ...current, budget: event.currentTarget.value }))} /></label><label>Start date<input type="date" value={values.startDate} onChange={(event) => setValues((current) => ({ ...current, startDate: event.currentTarget.value }))} /></label><label>End date<input type="date" value={values.endDate} onChange={(event) => setValues((current) => ({ ...current, endDate: event.currentTarget.value }))} /></label><button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Saving…" : "Create draft"}</button></form></Dialog>;
}

function ContentForm({ admin, onClose, onSave }: { admin: boolean; onClose: () => void; onSave: (input: Record<string, unknown>) => Promise<void> }) {
  const [values, setValues] = useState({ title: "", type: "social", channel: "", body: "", scheduledAt: "", status: "draft" });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); try { await onSave({ ...values, ...(values.scheduledAt ? { scheduledAt: values.scheduledAt } : {}) }); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); } }
  return <Dialog title="Create content record" onClose={onClose}><form className={styles.formGrid} onSubmit={submit}><label>Title<input value={values.title} onChange={(event) => setValues((current) => ({ ...current, title: event.currentTarget.value }))} required /></label><label>Type<select value={values.type} onChange={(event) => setValues((current) => ({ ...current, type: event.currentTarget.value }))}>{["social", "email", "blog", "video", "design"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Channel<input value={values.channel} onChange={(event) => setValues((current) => ({ ...current, channel: event.currentTarget.value }))} /></label><label>Schedule<input type="datetime-local" value={values.scheduledAt} onChange={(event) => setValues((current) => ({ ...current, scheduledAt: event.currentTarget.value }))} /></label><label>Status<select value={values.status} onChange={(event) => setValues((current) => ({ ...current, status: event.currentTarget.value }))}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="needs_review">Needs review</option></select></label><label className={styles.fieldWide}>Content<textarea rows={5} value={values.body} onChange={(event) => setValues((current) => ({ ...current, body: event.currentTarget.value }))} /></label><p className={styles.formWarning}>Creating or scheduling content does not publish externally.</p><button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Saving…" : "Save content"}</button></form></Dialog>;
}

function TaskForm({ onClose, onSave }: { onClose: () => void; onSave: (input: Record<string, unknown>) => Promise<void> }) {
  const [values, setValues] = useState({ title: "", description: "", dueAt: "" });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); try { await onSave({ ...values, ...(values.dueAt ? { dueAt: values.dueAt } : {}) }); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); } }
  return <Dialog title="Create Marketing task" onClose={onClose}><form className={styles.formGrid} onSubmit={submit}><label>Title<input value={values.title} onChange={(event) => setValues((current) => ({ ...current, title: event.currentTarget.value }))} required /></label><label>Due date<input type="date" value={values.dueAt} onChange={(event) => setValues((current) => ({ ...current, dueAt: event.currentTarget.value }))} /></label><label className={styles.fieldWide}>Description<input value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.currentTarget.value }))} /></label><button className={styles.primaryButton} type="submit" disabled={busy}>Create task</button></form></Dialog>;
}

function SocialDraftForm({ onClose, onSave }: { onClose: () => void; onSave: (input: Record<string, unknown>) => Promise<void> }) {
  const [values, setValues] = useState({ channel: "instagram", body: "", scheduledAt: "" });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); try { await onSave({ ...values, ...(values.scheduledAt ? { scheduledAt: values.scheduledAt } : {}) }); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); } }
  return <Dialog title="Save social draft" onClose={onClose}><form className={styles.formGrid} onSubmit={submit}><label>Channel<input value={values.channel} onChange={(event) => setValues((current) => ({ ...current, channel: event.currentTarget.value }))} required /></label><label>Schedule<input type="datetime-local" value={values.scheduledAt} onChange={(event) => setValues((current) => ({ ...current, scheduledAt: event.currentTarget.value }))} /></label><label className={styles.fieldWide}>Post text<textarea rows={5} value={values.body} onChange={(event) => setValues((current) => ({ ...current, body: event.currentTarget.value }))} required /></label><p className={styles.formWarning}>This saves a local draft only. Provider publishing is unavailable.</p><button className={styles.primaryButton} type="submit" disabled={busy}>Save draft</button></form></Dialog>;
}

function BlogForm({ onClose, onSave }: { onClose: () => void; onSave: (input: Record<string, unknown>) => Promise<void> }) {
  const [values, setValues] = useState({ title: "", slug: "", excerpt: "", body: "" });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); try { await onSave(values); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); } }
  return <Dialog title="Create blog draft" onClose={onClose}><form className={styles.formGrid} onSubmit={submit}><label>Title<input value={values.title} onChange={(event) => setValues((current) => ({ ...current, title: event.currentTarget.value }))} required /></label><label>Slug<input value={values.slug} onChange={(event) => setValues((current) => ({ ...current, slug: event.currentTarget.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }))} required /></label><label className={styles.fieldWide}>Excerpt<input value={values.excerpt} onChange={(event) => setValues((current) => ({ ...current, excerpt: event.currentTarget.value }))} /></label><label className={styles.fieldWide}>Body<textarea rows={7} value={values.body} onChange={(event) => setValues((current) => ({ ...current, body: event.currentTarget.value }))} /></label><button className={styles.primaryButton} type="submit" disabled={busy}>Save draft</button></form></Dialog>;
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className={styles.modalBackdrop}><section className={styles.formDialog} role="dialog" aria-modal="true" aria-label={title}><div className={styles.panelHeader}><div><h2>{title}</h2></div><button className={styles.iconAction} type="button" onClick={onClose} aria-label="Close"><X size={15} /></button></div>{children}</section></div>;
}

function UpcomingTasks({ items }: { items: MarketingTask[] }) {
  return <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Upcoming work</h2><p>Tasks returned by the Marketing API</p></div></div>{items.map((item) => <p className={styles.taskLine} key={item._id}>{item.title} · {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "No due date"}</p>)}{!items.length && <p className={styles.emptyInline}>No upcoming tasks found.</p>}</section>;
}

function Unavailable({ title, message }: { title: string; message: string }) {
  return <section className={styles.integrationState}><CircleAlert size={21} /><h2>{title}</h2><p>{message}</p></section>;
}

function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  return <div className={styles.pagination}><span>Page {page} of {pages}</span><div><button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous page">‹</button><button type="button" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages} aria-label="Next page">›</button></div></div>;
}
