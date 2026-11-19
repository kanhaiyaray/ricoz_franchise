"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  BadgeCheck,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  Printer,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { FranchiseApplicationService } from "@/services/application.service";
import type {
  ApproveApplicationInput,
  ApplicationDocumentKind,
  ApplicationDetailResponse,
  ApplicationsResponse,
  FranchiseApplicationDetail,
  FranchiseApplicationStatus,
  FranchiseApplicationSummary,
} from "@/services/types/application.types";
import styles from "./application-management.module.css";

type ApplicationFilter = "all" | "pending_review" | "approved" | "rejected";
type ApplicationData = ApplicationsResponse;
type ApprovalFormState = Record<keyof ApproveApplicationInput, string>;

const tabs: Array<{ label: string; value: ApplicationFilter }> = [
  { label: "All Applications", value: "all" },
  { label: "Pending", value: "pending_review" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

function statusLabel(status: FranchiseApplicationStatus) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "approving") return "Approval in progress";
  return "Submitted (Step 2)";
}

function statusClass(status: FranchiseApplicationStatus) {
  if (status === "approved") return styles.statusApproved;
  if (status === "rejected") return styles.statusRejected;
  if (status === "approving") return styles.statusApproving;
  return styles.statusPending;
}

function maskValue(value: string, visible: boolean, keep = 4) {
  if (visible) return value;
  return value.length <= keep
    ? "•".repeat(value.length)
    : `${"•".repeat(Math.min(8, value.length - keep))}${value.slice(-keep)}`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ApplicationManagement({
  initialQuery,
}: {
  initialQuery: string;
}) {
  const [data, setData] = useState<ApplicationData | null>(null);
  const [filter, setFilter] = useState<ApplicationFilter>("all");
  const [searchText, setSearchText] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery.trim());
  const [selectedApplication, setSelectedApplication] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchText.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    let active = true;
    const status = filter === "all" ? undefined : filter;
    FranchiseApplicationService.list(query, status)
      .then((result) => {
        if (!active) return;
        setData(result);
        setError("");
      })
      .catch((caughtError: unknown) => {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load franchise applications.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filter, query, refreshVersion]);

  function refresh() {
    setLoading(true);
    setRefreshVersion((version) => version + 1);
  }

  const applications = data?.applications ?? [];
  const stats = data?.stats;

  return (
    <section className={styles.page}>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>PARTNER NETWORK</p>
          <h1>Franchise Applications Management</h1>
          <p>Review candidate profiles and verification documents.</p>
        </div>
        <button
          className={styles.refreshButton}
          type="button"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw size={15} aria-hidden="true" />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Total Applications" value={stats?.totalApplications} icon={<FileText />} tone="neutral" />
        <StatCard label="Pending Review" value={stats?.pendingReview} icon={<Clock3 />} tone="pending" />
        <StatCard label="Approved Partners" value={stats?.approvedPartners} icon={<BadgeCheck />} tone="approved" />
        <StatCard label="Rejected Applications" value={stats?.rejectedApplications} icon={<XCircle />} tone="rejected" />
      </div>

      <section className={styles.applicationCard} aria-label="Franchise applications">
        <div className={styles.tableControls}>
          <div className={styles.tabs} role="tablist" aria-label="Application status">
            {tabs.map((tab) => {
              const count =
                tab.value === "pending_review"
                  ? stats?.pendingReview
                  : tab.value === "approved"
                    ? stats?.approvedPartners
                    : tab.value === "rejected"
                      ? stats?.rejectedApplications
                      : undefined;
              return (
                <button
                  key={tab.value}
                  className={`${styles.tab} ${filter === tab.value ? styles.tabActive : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={filter === tab.value}
                  onClick={() => {
                    setLoading(true);
                    setFilter(tab.value);
                  }}
                >
                  {tab.label}
                  {count !== undefined && ` (${count})`}
                </button>
              );
            })}
          </div>
          <label className={styles.tableSearch}>
            <Search size={15} aria-hidden="true" />
            <input
              value={searchText}
              onChange={(event) => {
                setLoading(true);
                setSearchText(event.currentTarget.value);
              }}
              placeholder="Search candidate name, email, city..."
              aria-label="Search applications by candidate, email, or city"
            />
          </label>
        </div>

        {error && <p className={styles.errorMessage} role="alert">{error}</p>}

        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Candidate Name</th>
                <th>Email Address</th>
                <th>Mobile Number</th>
                <th>City / State</th>
                <th>Investment</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <ApplicationRow
                  key={application._id}
                  application={application}
                  onView={() => setSelectedApplication(application._id)}
                />
              ))}
              {!applications.length && (
                <tr>
                  <td className={styles.emptyCell} colSpan={7}>
                    {loading
                      ? "Loading applications..."
                      : error
                        ? "Applications could not be loaded."
                        : query || filter !== "all"
                          ? "No applications match these filters."
                          : "No franchise applications have been submitted yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedApplication && (
        <ApplicationDetailDialog
          applicationId={selectedApplication}
          onClose={() => setSelectedApplication(null)}
          onUpdated={() => {
            setSelectedApplication(null);
            refresh();
          }}
        />
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value?: number;
  icon: React.ReactNode;
  tone: "neutral" | "pending" | "approved" | "rejected";
}) {
  return (
    <article className={`${styles.statCard} ${styles[`stat${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value ?? "—"}</div>
      <span className={styles.statIcon} aria-hidden="true">{icon}</span>
    </article>
  );
}

function ApplicationRow({
  application,
  onView,
}: {
  application: FranchiseApplicationSummary;
  onView: () => void;
}) {
  return (
    <tr>
      <td className={styles.candidateName}>{application.fullName}</td>
      <td>{application.email}</td>
      <td>+91 {application.mobile}</td>
      <td>{application.city}, {application.state}</td>
      <td>{application.investment}</td>
      <td>
        <span className={`${styles.status} ${statusClass(application.status)}`}>
          {statusLabel(application.status)}
        </span>
      </td>
      <td>
        <button className={styles.viewButton} type="button" onClick={onView}>
          View Details
        </button>
      </td>
    </tr>
  );
}

function ApplicationDetailDialog({
  applicationId,
  onClose,
  onUpdated,
}: {
  applicationId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [application, setApplication] = useState<FranchiseApplicationDetail | null>(null);
  const [mode, setMode] = useState<"details" | "approve" | "reject">("details");
  const [showSensitive, setShowSensitive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalForm, setApprovalForm] = useState<ApprovalFormState>({
    franchiseName: "",
    adminName: "",
    adminEmail: "",
    address: "",
    pincode: "",
    commissionRate: "",
    royaltyRate: "",
    monthlyTarget: "",
    maxStaff: "",
    maxTasks: "",
    territory: "",
  });
  const closeRef = useRef(onClose);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
        ),
      ).filter((element) => !element.closest("[hidden]"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    let active = true;
    FranchiseApplicationService.detail(applicationId)
      .then((result: ApplicationDetailResponse) => {
        if (active) {
          setApplication(result.application);
          setError("");
        }
      })
      .catch((caughtError: unknown) => {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load application details.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applicationId]);

  function beginApproval() {
    if (!application) return;
    setApprovalForm({
      franchiseName: "",
      adminName: application.fullName,
      adminEmail: application.email,
      address: "",
      pincode: "",
      commissionRate: "",
      royaltyRate: "",
      monthlyTarget: "",
      maxStaff: "",
      maxTasks: "",
      territory: "",
    });
    setError("");
    setMode("approve");
  }

  async function handleApprove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await FranchiseApplicationService.approve(applicationId, {
        ...approvalForm,
        commissionRate: Number(approvalForm.commissionRate),
        royaltyRate: Number(approvalForm.royaltyRate),
        monthlyTarget: Number(approvalForm.monthlyTarget),
        maxStaff: Number(approvalForm.maxStaff),
        maxTasks: Number(approvalForm.maxTasks),
      });
      toast.success("Application approved and invitation sent.");
      onUpdated();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to approve this application.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await FranchiseApplicationService.reject(
        applicationId,
        rejectionReason.trim(),
      );
      toast.success("Application rejected.");
      onUpdated();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to reject this application.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function downloadDocument(kind: ApplicationDocumentKind, name: string) {
    try {
      const file = await FranchiseApplicationService.downloadDocument(
        applicationId,
        kind,
      );
      downloadBlob(file, name);
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to download this document.",
      );
    }
  }

  function downloadSummary() {
    if (!application) return;
    const summary = {
      applicationId: application._id,
      fullName: application.fullName,
      email: application.email,
      mobile: application.mobile,
      city: application.city,
      state: application.state,
      occupation: application.occupation,
      investment: application.investment,
      reason: application.reason,
      aadhaarNumber: maskValue(application.aadhaarNumber, false),
      panNumber: maskValue(application.panNumber, false, 2),
      accountHolder: application.accountHolder,
      bankName: application.bankName,
      accountNumber: maskValue(application.accountNumber, false),
      ifscCode: application.ifscCode,
      status: application.status,
      submittedAt: application.createdAt,
    };
    downloadBlob(
      new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" }),
      `ricoz-application-${application._id}.json`,
    );
  }

  function updateApprovalField(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const { name, value } = event.currentTarget;
    setApprovalForm((current) => ({ ...current, [name]: value }));
  }

  return (
    <div
      className={styles.modalBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={styles.detailDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-detail-title"
        tabIndex={-1}
      >
        <header className={styles.dialogHeader}>
          <div>
            <div className={styles.dialogTitleRow}>
              <h2 id="application-detail-title">
                {mode === "approve"
                  ? "Set Up Franchise"
                  : mode === "reject"
                    ? "Reject Application"
                    : "Franchise Application Details"}
              </h2>
              {application && (
                <span className={`${styles.status} ${statusClass(application.status)}`}>
                  {statusLabel(application.status)}
                </span>
              )}
            </div>
            <p>{application ? `ID: app_${application._id}` : "Loading application..."}</p>
          </div>
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close details">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {error && <p className={styles.dialogError} role="alert">{error}</p>}
        {loading && <div className={styles.dialogLoading}>Loading application details...</div>}
        {!loading && application && mode === "details" && (
          <>
            <div className={styles.dialogBody}>
              <h3>1. Applicant Profile</h3>
              <DetailGroup>
                <DetailRow label="Full Name" value={application.fullName} />
                <DetailRow label="Email Address" value={application.email} />
                <DetailRow label="Mobile Number" value={`+91 ${application.mobile}`} />
                <DetailRow label="City / State" value={`${application.city}, ${application.state}`} />
                <DetailRow label="Occupation" value={application.occupation} />
                <DetailRow label="Investment Capacity" value={application.investment} />
                <DetailRow label="Reason for Joining" value={application.reason || "—"} />
              </DetailGroup>

              <div className={styles.sectionHeading}>
                <h3>2. Identity &amp; Financial Verification</h3>
                <button
                  className={styles.revealButton}
                  type="button"
                  onClick={() => setShowSensitive((value) => !value)}
                >
                  {showSensitive ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showSensitive ? "Hide sensitive values" : "Reveal sensitive values"}
                </button>
              </div>
              <DetailGroup>
                <DetailRow label="Aadhaar Number" value={maskValue(application.aadhaarNumber, showSensitive)} />
                <DetailRow label="PAN Number" value={maskValue(application.panNumber, showSensitive, 2)} />
                <DetailRow label="Bank Account Holder" value={application.accountHolder} />
                <DetailRow label="Bank Name" value={application.bankName} />
                <DetailRow label="Account Number" value={maskValue(application.accountNumber, showSensitive)} />
                <DetailRow label="IFSC Code" value={showSensitive ? application.ifscCode : maskValue(application.ifscCode, false, 4)} />
              </DetailGroup>

              <h3>3. Uploaded Documents</h3>
              <div className={styles.documentGrid}>
                {application.documents.map((document) => (
                  <article className={styles.documentCard} key={document.kind}>
                    <div className={styles.documentHeading}>
                      <FileText size={16} aria-hidden="true" />
                      <strong>
                        {document.kind === "aadhaar"
                          ? "Aadhaar Card"
                          : document.kind === "pan"
                            ? "PAN Card"
                            : "Bank Statement"}
                      </strong>
                    </div>
                    <small>{document.originalName} · {(document.size / (1024 * 1024)).toFixed(1)} MB</small>
                    <button
                      type="button"
                      onClick={() => downloadDocument(document.kind, document.originalName)}
                    >
                      <Download size={13} aria-hidden="true" /> Download securely
                    </button>
                  </article>
                ))}
                {!application.documents.length && (
                  <p className={styles.noDocuments}>No documents were uploaded.</p>
                )}
              </div>
            </div>
            <footer className={styles.dialogFooter}>
              <button className={styles.secondaryAction} type="button" onClick={() => window.print()}>
                <Printer size={14} aria-hidden="true" /> Print Application
              </button>
              <button className={styles.secondaryAction} type="button" onClick={downloadSummary}>
                <Download size={14} aria-hidden="true" /> Download Application
              </button>
              {application.status === "pending_review" && (
                <div className={styles.reviewActions}>
                  <button className={styles.rejectAction} type="button" onClick={() => setMode("reject")}>
                    <XCircle size={14} aria-hidden="true" /> Reject
                  </button>
                  <button className={styles.approveAction} type="button" onClick={beginApproval}>
                    <BadgeCheck size={14} aria-hidden="true" /> Approve &amp; Send Invitation
                  </button>
                </div>
              )}
            </footer>
          </>
        )}

        {!loading && mode === "approve" && application && (
          <form className={styles.setupForm} onSubmit={handleApprove}>
            <p className={styles.setupIntro}>
              Confirm the franchise details and commercial terms. Approval creates the franchise and emails an activation invitation to the account email below.
            </p>
            <div className={styles.setupGrid}>
              <SetupField label="Franchise Name" name="franchiseName" value={approvalForm.franchiseName} onChange={updateApprovalField} required />
              <SetupField label="Franchise Admin Name" name="adminName" value={approvalForm.adminName} onChange={updateApprovalField} required />
              <SetupField label="Invitation Email" name="adminEmail" type="email" value={approvalForm.adminEmail} onChange={updateApprovalField} required />
              <SetupField label="Full Franchise Address" name="address" value={approvalForm.address} onChange={updateApprovalField} required />
              <SetupField label="City" value={application.city} disabled />
              <SetupField label="State" value={application.state} disabled />
              <SetupField label="Pincode" name="pincode" value={approvalForm.pincode} onChange={updateApprovalField} required />
              <SetupField label="Territory (optional)" name="territory" value={approvalForm.territory} onChange={updateApprovalField} />
              <SetupField label="Commission Rate (%)" name="commissionRate" type="number" min="0" max="100" step="0.01" value={approvalForm.commissionRate} onChange={updateApprovalField} required />
              <SetupField label="Royalty Rate (%)" name="royaltyRate" type="number" min="0" max="100" step="0.01" value={approvalForm.royaltyRate} onChange={updateApprovalField} required />
              <SetupField label="Monthly Target (₹)" name="monthlyTarget" type="number" min="0" step="1" value={approvalForm.monthlyTarget} onChange={updateApprovalField} required />
              <SetupField label="Maximum Staff" name="maxStaff" type="number" min="1" step="1" value={approvalForm.maxStaff} onChange={updateApprovalField} required />
              <SetupField label="Maximum Tasks" name="maxTasks" type="number" min="1" step="1" value={approvalForm.maxTasks} onChange={updateApprovalField} required />
            </div>
            <div className={styles.setupActions}>
              <button className={styles.secondaryAction} type="button" onClick={() => setMode("details")}>
                Back to Application
              </button>
              <button className={styles.approveAction} type="submit" disabled={saving}>
                {saving ? "Creating franchise..." : "Create Franchise & Send Invitation"}
              </button>
            </div>
          </form>
        )}

        {!loading && mode === "reject" && application && (
          <form className={styles.rejectForm} onSubmit={handleReject}>
            <p>Rejecting this application will keep its submitted documents available for authorized review. This action cannot be undone.</p>
            <label>
              Rejection reason (optional)
              <textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.currentTarget.value)}
                maxLength={500}
                rows={4}
              />
            </label>
            <div className={styles.setupActions}>
              <button className={styles.secondaryAction} type="button" onClick={() => setMode("details")}>
                Back to Application
              </button>
              <button className={styles.rejectAction} type="submit" disabled={saving}>
                {saving ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function DetailGroup({ children }: { children: ReactNode }) {
  return <div className={styles.detailGroup}>{children}</div>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SetupField({
  label,
  value,
  onChange,
  name,
  type = "text",
  min,
  max,
  step,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  name?: string;
  type?: string;
  min?: string;
  max?: string;
  step?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={styles.setupField}>
      <span>{label}{required && " *"}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        required={required}
        disabled={disabled}
      />
    </label>
  );
}
