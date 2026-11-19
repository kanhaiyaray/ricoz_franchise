"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckSquare,
  CircleDollarSign,
  Clock3,
  Store,
  Users,
} from "lucide-react";
import { AdminService } from "@/services/admin.service";
import type { DashboardResponse } from "@/services/types/admin.types";
import QuickActions from "@/components/quick-actions";
import DateFilter from "@/components/date-filter";
import { downloadCsv } from "@/utils/csv";
import { isWithinRange, type DateRangeKey } from "@/utils/date-range";
import styles from "./admin.module.css";

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeKey>("all");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    AdminService.dashboard()
      .then((response) => {
        if (active) setData(response);
      })
      .catch((caughtError: unknown) => {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load the admin dashboard.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const stats = data?.stats;
  const pending = data?.pendingFranchises ?? [];
  const sourceTotal =
    (stats?.selfRegisteredAccounts ?? 0) + (stats?.adminCreated ?? 0);
  const selfRegisteredPercent = sourceTotal
    ? Math.round(((stats?.selfRegisteredAccounts ?? 0) / sourceTotal) * 100)
    : 0;
  const adminCreatedPercent = sourceTotal ? 100 - selfRegisteredPercent : 0;

  const filteredRecent = useMemo(() => {
    const list = data?.recentFranchises ?? [];
    return list.filter((franchise) =>
      isWithinRange(franchise.createdAt, dateRange),
    );
  }, [data?.recentFranchises, dateRange]);

  function handleExportRecent() {
    if (!filteredRecent.length) return;
    setExporting(true);
    try {
      downloadCsv(
        `ricoz-franchises-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Company", "Owner", "Email", "Status", "Created"],
        filteredRecent.map((franchise) => [
          franchise.name,
          franchise.ownerName,
          franchise.email,
          franchise.status,
          franchise.createdAt,
        ]),
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.welcomeCard}`}>
        <div className={styles.welcomeCopy}>
          <span className={styles.liveBadge}>
            <i className={styles.liveDot} />
            Live platform data
          </span>
          <h2>Good {new Date().getHours() < 12 ? "Morning" : "Afternoon"}</h2>
          <p>
            {loading
              ? "Loading your franchise network overview..."
              : stats
                ? `${stats.pendingActivation} franchise${stats.pendingActivation === 1 ? "" : "s"} awaiting account activation.`
                : "Dashboard data is currently unavailable."}
          </p>
          <div className={styles.welcomeActions}>
            <Link href="/admin/franchises" className={styles.primaryButton}>
              View Franchises
            </Link>
            <Link
              href="/admin/franchises/new"
              className={styles.secondaryButton}
            >
              Create Franchise
            </Link>
          </div>
        </div>
        <div className={styles.welcomeMetrics}>
          <div className={styles.welcomeMetric}>
            <strong>{loading || !stats ? "—" : stats.totalFranchises}</strong>
            <span>Franchises</span>
          </div>
          <div className={styles.welcomeMetric}>
            <strong>{loading || !stats ? "—" : stats.activeFranchises}</strong>
            <span>Active</span>
          </div>
          <div className={styles.welcomeMetric}>
            <strong>{loading || !stats ? "—" : stats.pendingActivation}</strong>
            <span>Pending</span>
          </div>
          <Link href="/admin/franchises">
            Open network overview <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <QuickActions role="admin" />

      {error && (
        <p className={styles.errorState} role="alert">
          {error}
        </p>
      )}

      <section className={`${styles.card} ${styles.sectionCard}`}>
        <div className={styles.sectionTitle}>
          <h2>Platform Status</h2>
          <span>Updated from the franchise database</span>
        </div>
        <div className={styles.metricGrid}>
          <Metric
            icon={Store}
            value={loading || !stats ? "—" : stats.totalFranchises}
            label="Total Franchises"
          />
          <Metric
            icon={Users}
            value={loading || !stats ? "—" : stats.selfRegisteredAccounts}
            label="Self-Registered Accounts"
          />
          <Metric
            icon={Building2}
            value={loading || !stats ? "—" : stats.adminCreated}
            label="Admin-Created Franchises"
          />
          <Metric
            icon={Activity}
            value={loading || !stats ? "—" : stats.activeFranchises}
            label="Active Franchises"
          />
          <Metric
            icon={Users}
            value={loading || !stats ? "—" : stats.totalEmployees}
            label="Active Employees"
          />
          <Metric
            icon={CircleDollarSign}
            value={
              stats?.revenue == null
                ? "—"
                : `₹${stats.revenue.toLocaleString("en-IN")}`
            }
            label="Recorded Revenue"
            unavailable={stats?.revenue == null}
          />
          <Metric
            icon={CheckSquare}
            value={stats?.tickets == null ? "—" : stats.tickets}
            label="Tickets"
            unavailable={stats?.tickets == null}
          />
          <Metric
            icon={Clock3}
            value={stats?.liveJobs == null ? "—" : stats.liveJobs}
            label="Live Jobs"
            unavailable={stats?.liveJobs == null}
          />
        </div>
        <p className={styles.dataNote}>
          Revenue, ticket, and job totals will populate when those operational
          modules are connected.
        </p>
      </section>

      <section className={`${styles.card} ${styles.sectionCard}`}>
        <div className={styles.sectionTitle}>
          <h2>Recently Registered Franchises</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <DateFilter
              value={dateRange}
              onChange={setDateRange}
              onExport={handleExportRecent}
              exporting={exporting}
            />
            <Link href="/admin/franchises" className={styles.linkButton}>
              View all <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        {loading ? (
          <div className={styles.loadingState}>Loading franchise records...</div>
        ) : filteredRecent.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Owner Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Registration Date</th>
                  <th>Created By</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredRecent.map((franchise) => (
                  <tr key={franchise._id}>
                    <td>
                      <Link href={`/admin/franchises/${franchise._id}`}>
                        {franchise.name}
                      </Link>
                    </td>
                    <td>{franchise.ownerName}</td>
                    <td>{franchise.email}</td>
                    <td>
                      <Status value={franchise.status} />
                    </td>
                    <td>{dateLabel(franchise.createdAt)}</td>
                    <td>{franchise.createdBy?.name ?? "Admin"}</td>
                    <td>
                      <Link
                        className={styles.rowAction}
                        href={`/admin/franchises/${franchise._id}`}
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            Dashboard records could not be loaded.
          </div>
        ) : (
          <div className={styles.emptyState}>
            {dateRange === "all"
              ? "No franchise records yet. Create the first franchise to get started."
              : "No franchises match the selected date range."}
          </div>
        )}
      </section>

      <div className={styles.twoColumn}>
        <section className={`${styles.card} ${styles.sectionCard}`}>
          <div className={styles.sectionTitle}>
            <h2>Franchises Awaiting Activation</h2>
            <span>{stats?.pendingActivation ?? "—"} Pending</span>
          </div>
          {pending.length ? (
            <>
              {pending.slice(0, 3).map((franchise) => (
                <Link
                  className={styles.pendingItem}
                  key={franchise._id}
                  href={`/admin/franchises/${franchise._id}?tab=users`}
                >
                  <span className={styles.pendingAvatar}>
                    {franchise.ownerName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className={styles.pendingText}>
                    <strong>{franchise.name}</strong>
                    <small>{franchise.email}</small>
                  </span>
                  <span className={styles.pendingStatus}>Invited</span>
                </Link>
              ))}
              <Link
                className={styles.fullWidthLink}
                href="/admin/franchises?status=invited"
              >
                View pending franchises <ArrowRight size={14} />
              </Link>
            </>
          ) : (
            <div className={styles.emptyState}>No pending activations.</div>
          )}
        </section>

        <section className={`${styles.card} ${styles.sectionCard}`}>
          <div className={styles.sectionTitle}>
            <h2>Registration Mix</h2>
            <span>{sourceTotal} accounts</span>
          </div>
          <div className={styles.mixRow}>
            <span>Self-Registered Accounts</span>
            <strong>{stats?.selfRegisteredAccounts ?? "—"}</strong>
          </div>
          <div className={styles.mixTrack}>
            <i style={{ width: `${selfRegisteredPercent}%` }} />
          </div>
          <div className={styles.mixRow}>
            <span>Admin-Created Franchises</span>
            <strong>{stats?.adminCreated ?? "—"}</strong>
          </div>
          <div className={`${styles.mixTrack} ${styles.mixTrackPurple}`}>
            <i style={{ width: `${adminCreatedPercent}%` }} />
          </div>
          {!sourceTotal && (
            <p className={styles.dataNote}>
              New registrations will be summarized here.
            </p>
          )}
        </section>
      </div>

      <section className={`${styles.card} ${styles.sectionCard}`}>
        <div className={styles.sectionTitle}>
          <h2>Admin Quick Tips</h2>
        </div>
        <div className={styles.quickTips}>
          <Tip>
            Review franchise account invitations and help partners activate
            promptly.
          </Tip>
          <Tip>
            Keep commission, royalty, and monthly target settings up to date.
          </Tip>
          <Tip>
            Operational metrics appear when their respective modules are
            connected.
          </Tip>
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
  unavailable = false,
}: {
  icon: typeof Store;
  value: number | string;
  label: string;
  unavailable?: boolean;
}) {
  return (
    <div className={styles.metricCell}>
      <Icon
        size={20}
        className={unavailable ? styles.metricIconMuted : undefined}
        aria-hidden="true"
      />
      <div>
        <div
          className={`${styles.metricValue} ${unavailable ? styles.mutedValue : ""}`}
        >
          {value}
        </div>
        <div className={styles.metricLabel}>{label}</div>
      </div>
    </div>
  );
}

function Status({ value }: { value: string }) {
  const statusClass =
    value === "active"
      ? styles.statusActive
      : value === "invited"
        ? styles.statusInvited
        : value === "suspended"
          ? styles.statusSuspended
          : value === "terminated"
            ? styles.statusTerminated
            : "";
  return (
    <span className={`${styles.status} ${statusClass}`}>{value}</span>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.quickTip}>
      <CheckSquare size={14} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
