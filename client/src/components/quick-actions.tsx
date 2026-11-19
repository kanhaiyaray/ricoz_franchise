"use client";

import Link from "next/link";
import {
  Store,
  Users,
  FileText,
  Megaphone,
  Receipt,
  ClipboardList,
} from "lucide-react";
import styles from "./quick-actions.module.css";

type ActionIcon =
  | "store"
  | "users"
  | "file"
  | "megaphone"
  | "receipt"
  | "task";

export type QuickAction = {
  label: string;
  href: string;
  icon: ActionIcon;
};

const adminActions: QuickAction[] = [
  { label: "Create Franchise", href: "/admin/franchises/new", icon: "store" },
  { label: "Add Employee", href: "/admin/employees", icon: "users" },
  { label: "Review Applications", href: "/admin/applications", icon: "file" },
];

const franchiseActions: QuickAction[] = [
  {
    label: "New Invoice",
    href: "/dashboard/finance/billing/invoices",
    icon: "receipt",
  },
  { label: "Add Lead", href: "/dashboard/sales/crm", icon: "users" },
  {
    label: "New Campaign",
    href: "/dashboard/marketing/campaigns",
    icon: "megaphone",
  },
  { label: "New Task", href: "/dashboard/sales/work", icon: "task" },
];

type Props = {
  role: "admin" | "franchise";
  actions?: QuickAction[];
};

export default function QuickActions({ role, actions }: Props) {
  const list = actions ?? (role === "admin" ? adminActions : franchiseActions);
  return (
    <section className={styles.panel} aria-label="Quick actions">
      <header className={styles.header}>
        <strong>Quick Actions</strong>
      </header>
      <div className={styles.grid}>
        {list.map((action) => (
          <Link key={action.href} href={action.href} className={styles.action}>
            <span className={styles.icon}>{renderIcon(action.icon)}</span>
            <span>{action.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function renderIcon(icon: ActionIcon) {
  if (icon === "store") return <Store size={16} />;
  if (icon === "users") return <Users size={16} />;
  if (icon === "file") return <FileText size={16} />;
  if (icon === "megaphone") return <Megaphone size={16} />;
  if (icon === "receipt") return <Receipt size={16} />;
  return <ClipboardList size={16} />;
}
