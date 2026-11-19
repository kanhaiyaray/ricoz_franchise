"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartNoAxesColumn,
  CircleHelp,
  CreditCard,
  FileText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Megaphone,
  Search,
  Settings,
  Store,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AuthService } from "@/services/auth.service";
import { clearAuth } from "@/redux/slice/auth.slice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { PortalGuard } from "@/features/auth/auth-pages";
import NotificationBell from "@/components/notification-bell";
import styles from "./admin.module.css";

const navigation = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Applications", href: "/admin/applications", icon: FileText },
  { label: "Franchises", href: "/admin/franchises", icon: Store },
  { label: "Task Queue", icon: ListChecks },
  { label: "Employees", href: "/admin/employees", icon: Users },
  { label: "Marketing", icon: Megaphone },
  { label: "Analytics", icon: ChartNoAxesColumn },
  { label: "Payments", icon: CreditCard },
  { label: "Settings", icon: Settings },
  { label: "Help & Support", icon: CircleHelp },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const user = useAppSelector((state) => state.auth.user);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await AuthService.logout();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to sign out.",
      );
    } finally {
      dispatch(clearAuth());
      router.replace("/login?portal=admin");
      setLoggingOut(false);
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    const destination = pathname.startsWith("/admin/applications")
      ? "/admin/applications"
      : pathname.startsWith("/admin/employees")
        ? "/admin/employees"
        : "/admin/franchises";
    router.push(
      query ? `${destination}?q=${encodeURIComponent(query)}` : destination,
    );
  }

  const currentTitle =
    pathname === "/admin"
      ? "Dashboard Overview"
      : pathname.startsWith("/admin/applications")
        ? "Franchise Partner Applications"
        : pathname.startsWith("/admin/employees")
          ? "Employee Directory"
          : pathname.includes("/franchises/new")
            ? "Create New Franchise"
            : pathname.includes("/franchises/")
              ? "Franchise Details"
              : "Franchise Network Management";

  return (
    <PortalGuard role="admin">
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <button
            className={styles.mobileMenu}
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <Link href="/admin" className={styles.brand}>
            <span className={styles.brandMark}>rZ</span>
            <span className={styles.brandText}>
              <strong>RICOZ</strong>
              <small>Admin Portal</small>
            </span>
          </Link>
          <div className={styles.topActions}>
            <div className={styles.breadcrumb}>
              <span>Admin</span>
              <span aria-hidden="true">›</span>
              <strong>{currentTitle}</strong>
            </div>
            <form className={styles.globalSearch} onSubmit={handleSearch}>
              <Search size={16} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                aria-label={
                  pathname.startsWith("/admin/applications")
                    ? "Search applications"
                    : pathname.startsWith("/admin/employees")
                      ? "Search employees"
                      : "Search franchises"
                }
                placeholder={
                  pathname.startsWith("/admin/applications")
                    ? "Search applicants..."
                    : pathname.startsWith("/admin/employees")
                      ? "Search employees..."
                      : "Search franchises..."
                }
              />
              <span className={styles.searchHint}>Enter</span>
            </form>
            <NotificationBell role="admin" />
            <div className={styles.userChip}>
              <span className={styles.avatar}>
                {initials(user?.user_name ?? "Admin")}
              </span>
              <span className={styles.userInfo}>
                <strong>{user?.user_email ?? "Admin account"}</strong>
                <small>Super Admin</small>
              </span>
            </div>
          </div>
        </header>

        <aside
          className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}
        >
          <nav className={styles.nav} aria-label="Admin navigation">
            <p className={styles.navLabel}>Main Operations</p>
            {navigation.map(({ label, href, icon: Icon }) =>
              href ? (
                <Link
                  key={label}
                  href={href}
                  className={`${styles.navLink} ${
                    pathname === href ||
                    (href !== "/admin" && pathname.startsWith(`${href}/`))
                      ? styles.navActive
                      : ""
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ) : (
                <div
                  className={styles.navDisabled}
                  key={label}
                  aria-disabled="true"
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{label}</span>
                  <small>Later</small>
                </div>
              ),
            )}
          </nav>
          <div className={styles.sidebarFooter}>
            <div className={styles.sidebarUser}>
              <span className={styles.avatar}>
                {initials(user?.user_name ?? "Admin")}
              </span>
              <span>
                <strong>{user?.user_name ?? "Administrator"}</strong>
                <small>{user?.user_email ?? ""}</small>
              </span>
            </div>
            <button
              className={styles.logoutButton}
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut size={14} />
              {loggingOut ? "Signing out..." : "Log Out"}
            </button>
          </div>
        </aside>

        <main
          className={styles.content}
          onClick={() => mobileOpen && setMobileOpen(false)}
        >
          {children}
        </main>
      </div>
    </PortalGuard>
  );
}
