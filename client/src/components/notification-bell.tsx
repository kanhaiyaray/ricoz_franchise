"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, FileText, Store, ClipboardList, Wallet, X } from "lucide-react";
import api from "@/services/axios";
import styles from "./notification-bell.module.css";

type Notification = {
  id: string;
  label: string;
  count: number;
  href: string;
  icon: "application" | "franchise" | "task" | "payment";
};

type Props = { role: "admin" | "franchise" };

export default function NotificationBell({ role }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const items: Notification[] = [];
      if (role === "admin") {
        try {
          const { data } = await api.get<{ stats: { pendingReview: number } }>(
            "/admin/applications?status=pending_review",
          );
          const count = data?.stats?.pendingReview ?? 0;
          if (count > 0) {
            items.push({
              id: "applications",
              label: "Franchise applications awaiting review",
              count,
              href: "/admin/applications",
              icon: "application",
            });
          }
        } catch {}

        try {
          const { data } = await api.get<{
            stats: { pendingActivation: number };
          }>("/admin/dashboard");
          const count = data?.stats?.pendingActivation ?? 0;
          if (count > 0) {
            items.push({
              id: "franchises",
              label: "Franchises awaiting activation",
              count,
              href: "/admin/franchises?status=invited",
              icon: "franchise",
            });
          }
        } catch {}
      } else {
        try {
          const { data } = await api.get<{ total: number }>(
            "/sales/accountability/tasks?status=pending",
          );
          if (data?.total) {
            items.push({
              id: "tasks",
              label: "Sales tasks awaiting review",
              count: data.total,
              href: "/dashboard/sales/approvals",
              icon: "task",
            });
          }
        } catch {}

        try {
          const { data } = await api.get<{ total: number }>(
            "/finance/billing/payments?status=pending",
          );
          if (data?.total) {
            items.push({
              id: "payments",
              label: "Payments pending verification",
              count: data.total,
              href: "/dashboard/finance/billing/payments",
              icon: "payment",
            });
          }
        } catch {}
      }

      if (active) {
        setNotifications(items);
        setLoading(false);
      }
    }

    void load();
    const interval = window.setInterval(load, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [role]);

  const total = notifications.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className={styles.wrap}>
      <button
        className={styles.button}
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={16} />
        {total > 0 && (
          <span className={styles.badge}>{total > 99 ? "99+" : total}</span>
        )}
      </button>
      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.panel} role="dialog" aria-label="Notifications">
            <header className={styles.header}>
              <strong>Notifications</strong>
              <button
                type="button"
                className={styles.close}
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              >
                <X size={14} />
              </button>
            </header>
            {loading ? (
              <p className={styles.empty}>Loading…</p>
            ) : notifications.length === 0 ? (
              <p className={styles.empty}>You&apos;re all caught up.</p>
            ) : (
              <ul className={styles.list}>
                {notifications.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={styles.item}
                      onClick={() => setOpen(false)}
                    >
                      <span className={styles.itemIcon}>{renderIcon(item.icon)}</span>
                      <span className={styles.itemText}>
                        <span>{item.label}</span>
                        <small>{item.count} pending</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function renderIcon(icon: Notification["icon"]) {
  if (icon === "application") return <FileText size={14} />;
  if (icon === "franchise") return <Store size={14} />;
  if (icon === "task") return <ClipboardList size={14} />;
  return <Wallet size={14} />;
}
