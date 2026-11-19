import type { ReactNode } from "react";
import AdminLayout from "@/features/admin/admin-shell";

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
