"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleDollarSign,
  Download,
  Edit3,
  Link2,
  Mail,
  Plus,
  Save,
  Shield,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminService } from "@/services/admin.service";
import type {
  FranchiseAuditLog,
  FranchiseDetailResponse,
  FranchiseRecord,
  FranchiseRole,
  FranchiseStatus,
  FranchiseUser,
  UpdateFranchiseInput,
} from "@/services/types/admin.types";
import styles from "./admin.module.css";

const tabs = ["Overview", "Users", "Finance", "Performance", "Audit Logs", "Settings"] as const;
type Tab = (typeof tabs)[number];

function dateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export default function FranchiseDetail({ id, initialTab = "Overview" }: {
  id: string;
  initialTab?: string;
}) {
  const [data, setData] = useState<FranchiseDetailResponse | null>(null);
  const [tab, setTab] = useState<Tab>(
    tabs.find((item) => item.toLowerCase() === initialTab.toLowerCase()) ?? "Overview",
  );
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [attachUserOpen, setAttachUserOpen] = useState(false);
  const [settings, setSettings] = useState<UpdateFranchiseInput | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await AdminService.franchise(id);
      setData(result);
      setSettings({
        name: result.franchise.name,
        ownerName: result.franchise.ownerName,
        email: result.franchise.email,
        phone: result.franchise.phone,
        address: result.franchise.address,
        city: result.franchise.city,
        state: result.franchise.state,
        pincode: result.franchise.pincode,
        commissionRate: result.franchise.commissionRate,
        royaltyRate: result.franchise.royaltyRate,
        monthlyTarget: result.franchise.monthlyTarget,
        maxStaff: result.franchise.maxStaff,
        maxTasks: result.franchise.maxTasks,
        territory: result.franchise.territory,
        permissions: { ...result.franchise.permissions },
      });
      setError("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load franchise details.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    AdminService.franchise(id)
      .then((result) => {
        if (!active) return;
        setData(result);
        setSettings({
          name: result.franchise.name,
          ownerName: result.franchise.ownerName,
          email: result.franchise.email,
          phone: result.franchise.phone,
          address: result.franchise.address,
          city: result.franchise.city,
          state: result.franchise.state,
          pincode: result.franchise.pincode,
          commissionRate: result.franchise.commissionRate,
          royaltyRate: result.franchise.royaltyRate,
          monthlyTarget: result.franchise.monthlyTarget,
          maxStaff: result.franchise.maxStaff,
          maxTasks: result.franchise.maxTasks,
          territory: result.franchise.territory,
          permissions: { ...result.franchise.permissions },
        });
        setError("");
      })
      .catch((caughtError: unknown) => {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load franchise details.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function setStatus(status: FranchiseStatus) {
    if (!data) return;
    const confirmation =
      status === "terminated"
        ? "Terminate this franchise? This permanently disables its accounts. The record will remain in audit history."
        : status === "suspended"
          ? "Suspend this franchise and disable its active accounts?"
          : data.franchise.status === "invited"
            ? "Activate this franchise and grant its linked users workspace access?"
            : "Reactivate this franchise?";
    if (!window.confirm(confirmation)) return;

    setActionLoading(true);
    try {
      await AdminService.setFranchiseStatus(data.franchise._id, status);
      toast.success(`Franchise ${status === "active" ? "reactivated" : status}.`);
      await load();
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update franchise status.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !settings) return;
    setActionLoading(true);
    try {
      await AdminService.updateFranchise(data.franchise._id, settings);
      toast.success("Franchise settings saved.");
      await load();
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save franchise settings.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function updateUser(userId: string, input: { name?: string; franchiseRole?: FranchiseRole }) {
    if (!data) return;
    setActionLoading(true);
    try {
      await AdminService.updateFranchiseUser(data.franchise._id, userId, input);
      toast.success("Franchise user updated.");
      await load();
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update user.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function resendInvitation(user: FranchiseUser) {
    if (!data) return;
    setActionLoading(true);
    try {
      const result = await AdminService.resendInvitation(data.franchise._id, user._id);
      toast.success(result.message ?? "Invitation sent.");
      await load();
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to send invitation.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function attachExistingUser(input: { email: string; franchiseRole: FranchiseRole }) {
    if (!data) return;
    setActionLoading(true);
    try {
      const result = await AdminService.attachFranchiseUser(data.franchise._id, input);
      toast.success(result.message ?? "Existing account linked.");
      if (data.franchise.status !== "active") {
        toast.info("Activate the franchise before the linked user can access its workspace.");
      }
      setAttachUserOpen(false);
      await load();
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to link the existing account.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading && !data) {
    return <div className={styles.loadingState}>Loading franchise details...</div>;
  }
  if (error && !data) {
    return (
      <div className={styles.page}>
        <p className={styles.errorState} role="alert">{error}</p>
        <Link href="/admin/franchises" className={styles.secondaryButton}>
          <ArrowLeft size={14} /> Back to Franchises
        </Link>
      </div>
    );
  }
  if (!data || !settings) return null;

  const franchise = data.franchise;

  return (
    <div className={styles.page}>
      <Link href="/admin/franchises" className={styles.wizardBack}>
        <ArrowLeft size={15} /> Back to Franchises
      </Link>
      {error && <p className={styles.errorState} role="alert">{error}</p>}
      <div className={styles.detailHeading}>
        <div className={styles.franchiseAvatar}>{franchise.name.slice(0, 2).toUpperCase()}</div>
        <div className={styles.detailTitle}>
          <div className={styles.titleLine}>
            <h1>{franchise.name}</h1>
            <Status value={franchise.status} />
          </div>
          <div className={styles.detailMeta}>
            <span>Owner: {franchise.ownerName}</span>
            <span><Mail size={13} /> {franchise.email}</span>
            <span>{[franchise.city, franchise.state].filter(Boolean).join(", ") || "Location not set"}</span>
            <span>Created: {dateTime(franchise.createdAt)}</span>
          </div>
        </div>
        <div className={styles.detailActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => setTab("Settings")}
            disabled={franchise.status === "terminated"}
          >
            <Edit3 size={14} /> Edit
          </button>
        </div>
      </div>

      <nav className={styles.tabs} aria-label="Franchise details">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            className={`${styles.tabButton} ${tab === item ? styles.tabActive : ""}`}
            aria-current={tab === item ? "page" : undefined}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {tab === "Overview" && (
        <Overview franchise={franchise} performance={data.performance} />
      )}
      {tab === "Users" && (
        <UsersPanel
          franchise={franchise}
          users={data.users}
          loading={actionLoading}
          onAdd={() => setAddUserOpen(true)}
          onAttach={() => setAttachUserOpen(true)}
          onUpdate={updateUser}
          onResend={resendInvitation}
        />
      )}
      {tab === "Finance" && <FinancePanel franchise={franchise} />}
      {tab === "Performance" && <PerformancePanel performance={data.performance} />}
      {tab === "Audit Logs" && <AuditPanel logs={data.auditLogs} />}
      {tab === "Settings" && (
        <SettingsPanel
          franchise={franchise}
          settings={settings}
          loading={actionLoading}
          onChange={setSettings}
          onSubmit={saveSettings}
          onStatus={setStatus}
        />
      )}

      {addUserOpen && (
        <AddUserModal
          franchiseId={franchise._id}
          loading={actionLoading}
          onClose={() => setAddUserOpen(false)}
          onCreated={async () => {
            setAddUserOpen(false);
            await load();
          }}
        />
      )}
      {attachUserOpen && (
        <AttachUserModal
          loading={actionLoading}
          onClose={() => setAttachUserOpen(false)}
          onAttach={attachExistingUser}
        />
      )}
    </div>
  );
}

function Overview({
  franchise,
  performance,
}: {
  franchise: FranchiseRecord;
  performance: FranchiseDetailResponse["performance"];
}) {
  return (
    <>
      <div className={styles.statCards}>
        <StatCard value={performance.revenue == null ? "—" : `₹${performance.revenue.toLocaleString("en-IN")}`} label="Total Revenue" />
        <StatCard value={performance.completedTasks ?? "—"} label="Completed Tasks" />
        <StatCard value={performance.customerRating == null ? "—" : `${performance.customerRating}/5`} label="Customer Rating" />
        <StatCard value={performance.slaCompliance == null ? "—" : `${performance.slaCompliance}%`} label="SLA Compliance" />
      </div>
      <div className={styles.infoGrid}>
        <section className={`${styles.card} ${styles.sectionCard}`}>
          <h2>Franchise Information</h2>
          <div className={styles.infoPairs}>
            <Info label="Franchise Name" value={franchise.name} />
            <Info label="Owner" value={franchise.ownerName} />
            <Info label="Email" value={franchise.email} />
            <Info label="Phone" value={franchise.phone} />
            <Info label="Address" value={franchise.address} />
            <Info label="Location" value={[franchise.city, franchise.state, franchise.pincode].filter(Boolean).join(", ")} />
            <Info label="Territory" value={franchise.territory || "Not assigned"} />
            <Info label="Status" value={franchise.status} />
          </div>
        </section>
        <section className={`${styles.card} ${styles.sectionCard}`}>
          <h2>Business Settings</h2>
          <Setting label="Commission" value={`${franchise.commissionRate}%`} />
          <Setting label="Royalty" value={`${franchise.royaltyRate}%`} />
          <Setting label="Monthly Target" value={`₹${franchise.monthlyTarget.toLocaleString("en-IN")}`} />
          <Setting label="Maximum Staff" value={franchise.maxStaff} />
          <Setting label="Maximum Tasks" value={franchise.maxTasks} />
        </section>
      </div>
      <p className={styles.dataNote}>{performance.message}</p>
    </>
  );
}

function UsersPanel({
  franchise,
  users,
  loading,
  onAdd,
  onAttach,
  onUpdate,
  onResend,
}: {
  franchise: FranchiseRecord;
  users: FranchiseUser[];
  loading: boolean;
  onAdd: () => void;
  onAttach: () => void;
  onUpdate: (userId: string, input: { franchiseRole?: FranchiseRole }) => void;
  onResend: (user: FranchiseUser) => void;
}) {
  return (
    <section className={`${styles.card} ${styles.sectionCard}`}>
      <div className={styles.sectionTitle}>
        <div>
          <h2>Franchise Users</h2>
          <span>{users.length} users linked to {franchise.name}</span>
        </div>
        <div className={styles.formActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={onAttach}
            disabled={loading || franchise.status === "suspended" || franchise.status === "terminated"}
          >
            <Link2 size={15} /> Link Existing Account
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={onAdd}
            disabled={loading || franchise.status === "suspended" || franchise.status === "terminated"}
          >
            <Plus size={15} /> Invite New User
          </button>
        </div>
      </div>
      {users.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserRow
                  key={user._id}
                  user={user}
                  loading={loading}
                  onUpdate={onUpdate}
                  onResend={onResend}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyState}>No users are linked to this franchise.</div>
      )}
    </section>
  );
}

function UserRow({
  user,
  loading,
  onUpdate,
  onResend,
}: {
  user: FranchiseUser;
  loading: boolean;
  onUpdate: (userId: string, input: { franchiseRole?: FranchiseRole }) => void;
  onResend: (user: FranchiseUser) => void;
}) {
  const [role, setRole] = useState<FranchiseRole>(user.franchiseRole ?? "staff");

  const roleLabel = role.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return (
    <tr>
      <td><strong>{user.name}</strong><span className={styles.subText}>{roleLabel}</span></td>
      <td>{user.email}</td>
      <td>
        <select
          className={styles.roleSelect}
          value={role}
          onChange={(event) => setRole(event.currentTarget.value as FranchiseRole)}
          aria-label={`Role for ${user.name}`}
        >
          <option value="franchise_admin">Franchise Admin</option>
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
        </select>
      </td>
      <td>{dateTime(user.lastSeen)}</td>
      <td><Status value={user.accountStatus === "disabled" ? "suspended" : user.accountStatus} /></td>
      <td>
        <div className={styles.rowActions}>
          {role !== user.franchiseRole && (
            <button
              className={styles.rowAction}
              type="button"
              disabled={loading}
              onClick={() => onUpdate(user._id, { franchiseRole: role })}
            >
              Save Role
            </button>
          )}
          <button
            className={styles.rowAction}
            type="button"
            disabled={loading || user.accountStatus === "disabled"}
            onClick={() => onResend(user)}
          >
            {user.accountStatus === "invited" ? "Resend Invite" : "Reset Password"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function FinancePanel({ franchise }: { franchise: FranchiseRecord }) {
  return (
    <>
      <div className={styles.statCards}>
        <StatCard value="—" label="Total Revenue (YTD)" />
        <StatCard value={`${franchise.commissionRate}%`} label="Commission Rate" />
        <StatCard value={`${franchise.royaltyRate}%`} label="Royalty Rate" />
        <StatCard value={`₹${franchise.monthlyTarget.toLocaleString("en-IN")}`} label="Monthly Target" />
      </div>
      <section className={`${styles.card} ${styles.sectionCard}`}>
        <div className={styles.sectionTitle}>
          <h2>Recent Invoices</h2>
          <button className={styles.secondaryButton} type="button" disabled>
            <Download size={14} /> Export
          </button>
        </div>
        <p className={styles.dataNote}>
          Invoice and payment records are not available yet. Revenue values are intentionally not estimated.
        </p>
      </section>
    </>
  );
}

function PerformancePanel({
  performance,
}: {
  performance: FranchiseDetailResponse["performance"];
}) {
  return (
    <section className={`${styles.card} ${styles.sectionCard}`}>
      <div className={styles.sectionTitle}>
        <h2>Performance</h2>
        <span>Franchise operating metrics</span>
      </div>
      <div className={styles.metricGrid}>
        <Metric label="Task Completion" value={performance.completedTasks == null ? "—" : performance.completedTasks} />
        <Metric label="Customer Satisfaction" value={performance.customerRating == null ? "—" : `${performance.customerRating}/5`} />
        <Metric label="SLA Compliance" value={performance.slaCompliance == null ? "—" : `${performance.slaCompliance}%`} />
        <Metric label="Revenue" value={performance.revenue == null ? "—" : `₹${performance.revenue.toLocaleString("en-IN")}`} />
      </div>
      <p className={styles.dataNote}>{performance.message}</p>
    </section>
  );
}

function AuditPanel({ logs }: { logs: FranchiseAuditLog[] }) {
  return (
    <section className={`${styles.card} ${styles.sectionCard}`}>
      <div className={styles.sectionTitle}>
        <h2>Audit Logs</h2>
        <span>Recorded changes for this franchise</span>
      </div>
      {logs.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Actor</th><th>Action</th><th>Details</th><th>Timestamp</th></tr></thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id}>
                  <td>{typeof log.actorId === "object" ? log.actorId?.name ?? log.actorId?.email : "System"}</td>
                  <td><strong>{log.action}</strong></td>
                  <td>{log.details || "—"}</td>
                  <td>{dateTime(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyState}>No audit events have been recorded.</div>
      )}
    </section>
  );
}

function SettingsPanel({
  franchise,
  settings,
  loading,
  onChange,
  onSubmit,
  onStatus,
}: {
  franchise: FranchiseRecord;
  settings: UpdateFranchiseInput;
  loading: boolean;
  onChange: (value: UpdateFranchiseInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStatus: (status: FranchiseStatus) => void;
}) {
  function update<K extends keyof UpdateFranchiseInput>(
    key: K,
    value: UpdateFranchiseInput[K],
  ) {
    onChange({ ...settings, [key]: value });
  }

  function updatePermission(
    key: keyof FranchiseRecord["permissions"],
    value: boolean,
  ) {
    onChange({
      ...settings,
      permissions: { ...settings.permissions, [key]: value },
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <section className={`${styles.card} ${styles.sectionCard}`}>
        <h2>General Settings</h2>
        <div className={styles.formGrid}>
          <SettingsField label="Franchise Name" value={settings.name ?? ""} onChange={(value) => update("name", value)} />
          <SettingsField label="Owner Name" value={settings.ownerName ?? ""} onChange={(value) => update("ownerName", value)} />
          <SettingsField label="Contact Email" type="email" value={settings.email ?? ""} onChange={(value) => update("email", value)} />
          <SettingsField label="Contact Phone" value={settings.phone ?? ""} onChange={(value) => update("phone", value)} />
          <SettingsField label="Address" value={settings.address ?? ""} onChange={(value) => update("address", value)} />
          <SettingsField label="City" value={settings.city ?? ""} onChange={(value) => update("city", value)} />
          <SettingsField label="State" value={settings.state ?? ""} onChange={(value) => update("state", value)} />
          <SettingsField label="Pincode" value={settings.pincode ?? ""} onChange={(value) => update("pincode", value)} />
          <SettingsField label="Territory" value={settings.territory ?? ""} onChange={(value) => update("territory", value)} />
        </div>
      </section>
      <section className={`${styles.card} ${styles.sectionCard}`}>
        <h2>Financial Configuration</h2>
        <div className={styles.formGrid}>
          <SettingsField label="Commission Rate (%)" type="number" min="0" max="100" value={settings.commissionRate ?? 0} onChange={(value) => update("commissionRate", Number(value))} />
          <SettingsField label="Royalty Fee (%)" type="number" min="0" max="100" value={settings.royaltyRate ?? 0} onChange={(value) => update("royaltyRate", Number(value))} />
          <SettingsField label="Monthly Target (₹)" type="number" min="0" value={settings.monthlyTarget ?? 0} onChange={(value) => update("monthlyTarget", Number(value))} />
          <SettingsField label="Maximum Staff" type="number" min="1" value={settings.maxStaff ?? 1} onChange={(value) => update("maxStaff", Number(value))} />
          <SettingsField label="Maximum Tasks" type="number" min="1" value={settings.maxTasks ?? 1} onChange={(value) => update("maxTasks", Number(value))} />
        </div>
      </section>
      <section className={`${styles.card} ${styles.sectionCard}`}>
        <h2><Shield size={17} /> Access &amp; Permissions</h2>
        <div className={styles.settingsList}>
          <Permission label="Allow franchise to view network revenue" checked={settings.permissions?.viewNetworkRevenue ?? false} onChange={(value) => updatePermission("viewNetworkRevenue", value)} />
          <Permission label="Allow franchise to export reports" checked={settings.permissions?.exportReports ?? false} onChange={(value) => updatePermission("exportReports", value)} />
          <Permission label="Allow franchise to add employees without approval" checked={settings.permissions?.addEmployeesWithoutApproval ?? false} onChange={(value) => updatePermission("addEmployeesWithoutApproval", value)} />
        </div>
      </section>
      <div className={styles.settingsActions}>
        <Link href={`/admin/franchises/${franchise._id}`} className={styles.secondaryButton}>Cancel</Link>
        <button className={styles.primaryButton} type="submit" disabled={loading || franchise.status === "terminated"}>
          <Save size={14} /> {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>
      <section className={`${styles.dangerZone} ${styles.dangerSection}`}>
        <h2><TriangleAlert size={16} /> Danger Zone</h2>
        <DangerAction
          title={franchise.status === "active" ? "Suspend Franchise" : franchise.status === "suspended" ? "Reactivate Franchise" : "Activate Franchise"}
          description={franchise.status === "active" ? "Temporarily disable franchise account access." : "Grant linked franchise users access to their workspace."}
          button={franchise.status === "active" ? "Suspend" : franchise.status === "suspended" ? "Reactivate" : "Activate"}
          onClick={() => void onStatus(franchise.status === "active" ? "suspended" : "active")}
          disabled={loading || franchise.status === "terminated"}
          danger={false}
        />
        <DangerAction
          title="Terminate Franchise"
          description="Permanently disable this franchise. Its record and audit history will be retained."
          button="Terminate"
          onClick={() => void onStatus("terminated")}
          disabled={loading || franchise.status === "terminated"}
          danger
        />
      </section>
    </form>
  );
}

function SettingsField({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  min?: string;
  max?: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        required
      />
    </label>
  );
}

function Permission({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.settingRow}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  );
}

function AddUserModal({
  franchiseId,
  loading,
  onClose,
  onCreated,
}: {
  franchiseId: string;
  loading: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<FranchiseRole>("manager");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await AdminService.addFranchiseUser(franchiseId, {
        name: name.trim(),
        email: email.trim(),
        franchiseRole: role,
      });
      toast.success("Invitation email sent.");
      await onCreated();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to invite this user.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="add-user-title">
        <header className={styles.modalHeader}>
          <h2 id="add-user-title">Invite Franchise User</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <form className={styles.formStack} onSubmit={submit}>
          <SettingsField label="Full Name" value={name} onChange={setName} />
          <SettingsField label="Email Address" type="email" value={email} onChange={setEmail} />
          <label className={styles.field}>
            <span>Franchise Role</span>
            <select value={role} onChange={(event) => setRole(event.currentTarget.value as FranchiseRole)}>
              <option value="franchise_admin">Franchise Admin</option>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </select>
          </label>
          {error && <p className={styles.formError} role="alert">{error}</p>}
          <p className={styles.dataNote}>An invitation link will be sent to this email. It expires after 72 hours.</p>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.primaryButton} disabled={saving || loading}>
              <Mail size={14} /> {saving ? "Sending..." : "Send Invitation"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AttachUserModal({
  loading,
  onClose,
  onAttach,
}: {
  loading: boolean;
  onClose: () => void;
  onAttach: (input: { email: string; franchiseRole: FranchiseRole }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<FranchiseRole>("franchise_admin");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await onAttach({ email: email.trim(), franchiseRole: role });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="attach-user-title">
        <header className={styles.modalHeader}>
          <h2 id="attach-user-title">Link Existing Franchise Account</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <form className={styles.formStack} onSubmit={submit}>
          <SettingsField label="Registered Email Address" type="email" value={email} onChange={setEmail} />
          <label className={styles.field}>
            <span>Franchise Role</span>
            <select value={role} onChange={(event) => setRole(event.currentTarget.value as FranchiseRole)}>
              <option value="franchise_admin">Franchise Admin</option>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </select>
          </label>
          <p className={styles.dataNote}>
            This links an active, self-registered franchise account that is not already assigned. The account keeps its existing password.
          </p>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.primaryButton} disabled={saving || loading}>
              <Link2 size={14} /> {saving ? "Linking..." : "Link Account"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Status({ value }: { value: string }) {
  const normalized = value === "disabled" ? "suspended" : value;
  const className =
    normalized === "active"
      ? styles.statusActive
      : normalized === "invited"
        ? styles.statusInvited
        : normalized === "suspended"
          ? styles.statusSuspended
          : styles.statusTerminated;
  return <span className={`${styles.status} ${className}`}>{normalized}</span>;
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className={`${styles.card} ${styles.statCard}`}>
      <span className={styles.statIcon}><CircleDollarSign size={20} /></span>
      <strong className={styles.statNumber}>{value}</strong>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoPair}>
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function Setting({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.settingRow}>
      <span>{label}</span><strong>{value}</strong>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.metricCell}>
      <strong className={`${styles.metricValue} ${value === "—" ? styles.mutedValue : ""}`}>{value}</strong>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  );
}

function DangerAction({
  title,
  description,
  button,
  onClick,
  disabled,
  danger,
}: {
  title: string;
  description: string;
  button: string;
  onClick: () => void;
  disabled: boolean;
  danger: boolean;
}) {
  return (
    <div className={styles.dangerAction}>
      <span><strong>{title}</strong><small>{description}</small></span>
      <button
        className={danger ? styles.dangerButton : styles.secondaryButton}
        type="button"
        onClick={onClick}
        disabled={disabled}
      >
        {danger && <TriangleAlert size={13} />}
        {button}
      </button>
    </div>
  );
}
