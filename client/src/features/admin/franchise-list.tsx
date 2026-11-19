"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Clock3, Plus, Search, Store } from "lucide-react";
import { AdminService } from "@/services/admin.service";
import type {
  DashboardResponse,
  FranchiseRecord,
  FranchiseStatus,
} from "@/services/types/admin.types";
import styles from "./admin.module.css";

type ListResponse = {
  success: true;
  franchises: FranchiseRecord[];
  total: number;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

export default function FranchiseList({
  initialQuery = "",
  initialStatus = "",
}: {
  initialQuery?: string;
  initialStatus?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [records, setRecords] = useState<FranchiseRecord[]>([]);
  const [stats, setStats] = useState<DashboardResponse["stats"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      Promise.all([
        AdminService.listFranchises(query, status) as Promise<ListResponse>,
        AdminService.dashboard(),
      ])
        .then(([list, dashboard]) => {
          if (!active) return;
          setRecords(list.franchises);
          setStats(dashboard.stats);
          setError("");
        })
        .catch((caughtError: unknown) => {
          if (active) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load franchise records.",
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, query === initialQuery && status === initialStatus ? 0 : 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [initialQuery, initialStatus, query, status]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeading}>
        <div>
          <h1>Franchise Network</h1>
          <p>Manage Ricoz franchise locations, invitations, and account status.</p>
        </div>
        <Link href="/admin/franchises/new" className={styles.primaryButton}>
          <Plus size={16} /> Create Franchise
        </Link>
      </div>

      <div className={styles.statCards}>
        <StatCard icon={Store} value={stats?.totalFranchises ?? "—"} label="Total Franchises" />
        <StatCard icon={CheckCircle2} value={stats?.activeFranchises ?? "—"} label="Active Franchises" />
        <StatCard icon={Clock3} value={stats?.pendingActivation ?? "—"} label="Pending Activation" />
        <StatCard icon={Ban} value={stats?.suspendedFranchises ?? "—"} label="Suspended" />
      </div>

      <section className={`${styles.card} ${styles.sectionCard}`}>
        <div className={styles.sectionTitle}>
          <h2>Search Franchise</h2>
          <span>{loading ? "Loading..." : `${records.length} shown`}</span>
        </div>
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <Search size={17} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search by company, owner, or email..."
              aria-label="Search franchises"
            />
          </label>
          <select
            className={styles.select}
            value={status}
            onChange={(event) => setStatus(event.currentTarget.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="invited">Invited</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
          </select>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              setQuery("");
              setStatus("");
              router.replace("/admin/franchises");
            }}
          >
            Clear filters
          </button>
        </div>
        {error && <p className={styles.errorState} role="alert">{error}</p>}
      </section>

      <section className={`${styles.card} ${styles.tableCard}`}>
        {loading ? (
          <div className={styles.loadingState}>Loading franchise network...</div>
        ) : records.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Franchise Name</th>
                  <th>Owner</th>
                  <th>Email</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record._id}>
                    <td>
                      <Link href={`/admin/franchises/${record._id}`}>{record.name}</Link>
                      <span className={styles.subText}>{record.territory || "Territory not assigned"}</span>
                    </td>
                    <td>{record.ownerName}</td>
                    <td>{record.email}</td>
                    <td>{[record.city, record.state].filter(Boolean).join(", ") || "—"}</td>
                    <td><Status value={record.status} /></td>
                    <td>{formatDate(record.createdAt)}</td>
                    <td>
                      <Link
                        className={styles.rowAction}
                        href={`/admin/franchises/${record._id}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            {error
              ? "Franchise records could not be loaded."
              : query || status
              ? "No franchise records match these filters."
              : "No franchise records yet. Create a franchise to start your network."}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Store;
  value: number | string;
  label: string;
}) {
  return (
    <div className={`${styles.card} ${styles.statCard}`}>
      <span className={styles.statIcon}><Icon size={20} /></span>
      <strong className={styles.statNumber}>{value}</strong>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function Status({ value }: { value: FranchiseStatus }) {
  const className =
    value === "active"
      ? styles.statusActive
      : value === "invited"
        ? styles.statusInvited
        : value === "suspended"
          ? styles.statusSuspended
          : styles.statusTerminated;
  return <span className={`${styles.status} ${className}`}>{value}</span>;
}
