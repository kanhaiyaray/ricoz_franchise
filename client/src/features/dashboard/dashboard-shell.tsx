"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Banknote,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  ReceiptText,
  Settings2,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { clearAuth } from "@/redux/slice/auth.slice";
import { AuthService } from "@/services/auth.service";
import api from "@/services/axios";
import { portalBrand } from "@/config/portal-brand";
import NotificationBell from "@/components/notification-bell";
import styles from "./dashboard-shell.module.css";

type NavItem = { label: string; href: string; icon: typeof LayoutDashboard };
type NavSection = { label: string; items: NavItem[] };

const navigation: NavSection[] = [
  {
    label: "Finance",
    items: [
      { label: "Overview", href: "/dashboard/finance", icon: LayoutDashboard },
      { label: "Revenue Projections", href: "/dashboard/finance/revenue-projections", icon: ChartNoAxesCombined },
      { label: "Resource Planning", href: "/dashboard/finance/resource-planning", icon: Users },
      { label: "Cost Planning", href: "/dashboard/finance/cost-planning", icon: Banknote },
      { label: "Financial Summary", href: "/dashboard/finance/financial-summary", icon: BarChart3 },
      { label: "AI Forecast", href: "/dashboard/finance/ai-forecast", icon: Activity },
      { label: "Billing Dashboard", href: "/dashboard/finance/billing/dashboard", icon: WalletCards },
      { label: "Accounting", href: "/dashboard/finance/billing/accounting", icon: BookOpenCheck },
      { label: "Invoices", href: "/dashboard/finance/billing/invoices", icon: ReceiptText },
      { label: "Payments", href: "/dashboard/finance/billing/payments", icon: CreditCard },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Dashboard", href: "/dashboard/sales", icon: LayoutDashboard },
      { label: "Calendar", href: "/dashboard/sales/calendar", icon: CalendarDays },
      { label: "My Work", href: "/dashboard/sales/work", icon: ClipboardList },
      { label: "Approvals", href: "/dashboard/sales/approvals", icon: BookOpenCheck },
      { label: "CRM & Leads", href: "/dashboard/sales/crm", icon: Users },
      { label: "Client Lists / Lead Source", href: "/dashboard/sales/lead-source", icon: FileText },
      { label: "Follow-ups", href: "/dashboard/sales/follow-ups", icon: CalendarDays },
      { label: "AI Assistant", href: "/dashboard/sales/assistant", icon: MessageSquareText },
      { label: "Customers", href: "/dashboard/sales/customers", icon: Users },
      { label: "Reports", href: "/dashboard/sales/reports", icon: BarChart3 },
      { label: "Integrations", href: "/dashboard/sales/integrations", icon: Settings2 },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Dashboard", href: "/dashboard/marketing", icon: LayoutDashboard },
      { label: "My Work", href: "/dashboard/marketing/work", icon: ClipboardList },
      { label: "Calendar", href: "/dashboard/marketing/calendar", icon: CalendarDays },
      { label: "Approvals", href: "/dashboard/marketing/approvals", icon: BookOpenCheck },
      { label: "Department Requests", href: "/dashboard/marketing/requests", icon: FileText },
      { label: "Campaigns", href: "/dashboard/marketing/campaigns", icon: Megaphone },
      { label: "Content Calendar", href: "/dashboard/marketing/content", icon: CalendarDays },
      { label: "Lead Generation", href: "/dashboard/marketing/leads", icon: Users },
      { label: "Social Hub", href: "/dashboard/marketing/social", icon: MessageSquareText },
      { label: "Creative Studio", href: "/dashboard/marketing/creative", icon: BookOpenCheck },
      { label: "Publishing", href: "/dashboard/marketing/publishing", icon: Megaphone },
      { label: "Budget", href: "/dashboard/marketing/budget", icon: Banknote },
      { label: "Attribution", href: "/dashboard/marketing/attribution", icon: ChartNoAxesCombined },
      { label: "Analytics", href: "/dashboard/marketing/analytics", icon: BarChart3 },
      { label: "Reports", href: "/dashboard/marketing/reports", icon: FileText },
      { label: "AI Assistant", href: "/dashboard/marketing/assistant", icon: MessageSquareText },
    ],
  },
];

type FranchiseOption = { _id: string; name: string };

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function routeTitle(pathname: string) {
  for (const section of navigation) {
    const found = section.items.find((item) => item.href === pathname);
    if (found) return found.label;
  }
  if (pathname.startsWith("/dashboard/finance/billing/payments/")) {
    return "Payment Details";
  }
  if (pathname.startsWith("/dashboard/finance/billing/invoices/")) {
    return "Invoice Details";
  }
  return "Workspace";
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAppSelector((state) => state.auth);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [franchises, setFranchises] = useState<FranchiseOption[]>([]);
  const [selectedFranchise, setSelectedFranchise] = useState("");
  const [franchiseError, setFranchiseError] = useState("");
  const admin = auth.user?.user_role === "admin";

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      router.replace(
        `/login?portal=franchise&redirect=${encodeURIComponent(pathname)}`,
      );
    }
  }, [auth.status, pathname, router]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    if (!admin) {
      window.localStorage.removeItem("dashboard-franchise-scope");
      return;
    }
    let active = true;
    api
      .get<{ success: true; franchises: FranchiseOption[] }>("/admin/franchises")
      .then(({ data }) => {
        if (!active) return;
        setFranchises(data.franchises);
        setSelectedFranchise(
          window.localStorage.getItem("dashboard-franchise-scope") ?? "",
        );
        setFranchiseError("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFranchiseError(
          axios.isAxiosError<{ message?: string }>(error)
            ? error.response?.data?.message ?? "Unable to load franchise scope."
            : "Unable to load franchise scope.",
        );
      });
    return () => {
      active = false;
    };
  }, [admin, auth.status]);

  async function logout() {
    setLoggingOut(true);
    try {
      await AuthService.logout();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to sign out.",
      );
    } finally {
      dispatch(clearAuth());
      router.replace("/login");
      setLoggingOut(false);
    }
  }

  function changeFranchise(franchiseId: string) {
    setSelectedFranchise(franchiseId);
    if (franchiseId) {
      window.localStorage.setItem("dashboard-franchise-scope", franchiseId);
    } else {
      window.localStorage.removeItem("dashboard-franchise-scope");
    }
    window.dispatchEvent(new Event("dashboard-scope-change"));
  }

  const brandStyle = {
    "--workspace-accent": portalBrand.accent,
  } as CSSProperties;

  if (auth.status !== "authenticated" || !auth.user) {
    return (
      <main className={styles.guard} style={brandStyle} aria-live="polite">
        <p>Checking workspace access…</p>
      </main>
    );
  }

  return (
    <div className={styles.shell} style={brandStyle}>
      <header className={styles.topbar}>
        <button
          className={styles.mobileMenu}
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <Link href="/dashboard/finance" className={styles.brand}>
          <span className={styles.brandMark}>{portalBrand.mark}</span>
          <span className={styles.brandText}>
            <strong>{portalBrand.name}</strong>
            <small>{portalBrand.subtitle}</small>
          </span>
        </Link>
        <div className={styles.headerRight}>
          <div className={styles.breadcrumb}>
            <span>Workspace</span>
            <span aria-hidden="true">›</span>
            <strong>{routeTitle(pathname)}</strong>
          </div>
          {admin && (
            <label className={styles.scopeSelect}>
              <span>Franchise scope</span>
              <select
                value={selectedFranchise}
                onChange={(event) => changeFranchise(event.currentTarget.value)}
                disabled={Boolean(franchiseError)}
                aria-label="Select franchise scope"
              >
                <option value="">All franchises</option>
                {franchises.map((franchise) => (
                  <option key={franchise._id} value={franchise._id}>
                    {franchise.name}
                  </option>
                ))}
              </select>
              <ChevronDown className={styles.scopeChevron} size={13} />
            </label>
          )}
          <NotificationBell role="franchise" />
          <div className={styles.account}>
            <span className={styles.accountAvatar}>
              {initials(auth.user.user_name || "U")}
            </span>
            <span>
              <strong>{auth.user.user_name}</strong>
              <small>
                {admin ? "Administrator · All franchises" : "Franchise workspace"}
              </small>
            </span>
          </div>
          <button
            type="button"
            className={styles.logout}
            onClick={() => void logout()}
            disabled={loggingOut}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}
      >
        <div className={styles.sidebarHeading}>
          <span>Business Workspace</span>
          <PanelLeftClose size={15} />
        </div>
        <nav aria-label="Finance, Sales and Marketing">
          {navigation.map((section) => (
            <section className={styles.navSection} key={section.label}>
              <h2>{section.label}</h2>
              {section.items.map(({ label, href, icon: Icon }) => {
                const active =
                  pathname === href ||
                  (href !== "/dashboard/finance" &&
                    href !== "/dashboard/sales" &&
                    href !== "/dashboard/marketing" &&
                    pathname.startsWith(`${href}/`));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`${styles.navLink} ${active ? styles.navActive : ""}`}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </section>
          ))}
          <Link href="/dashboard/finance" className={styles.helpLink}>
            <CircleHelp size={16} />
            <span>Help & Support</span>
          </Link>
        </nav>
        {admin && franchiseError && (
          <p className={styles.scopeError} role="alert">
            {franchiseError}
          </p>
        )}
        <div className={styles.sidebarFooter}>
          <span>
            {admin ? "Global administrator" : "Tenant-isolated access"}
          </span>
        </div>
      </aside>

      {mobileOpen && (
        <button
          className={styles.mobileBackdrop}
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <main
        className={styles.content}
        onClick={() => mobileOpen && setMobileOpen(false)}
      >
        {children}
      </main>
    </div>
  );
}
