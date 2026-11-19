import { notFound } from "next/navigation";
import SalesWorkspace, { type SalesView } from "@/features/sales/sales-workspace";

type SalesPageProps = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveView(path: string[] = []): SalesView | null {
  const routes: Record<string, SalesView> = {
    "": "dashboard",
    calendar: "calendar",
    work: "work",
    approvals: "approvals",
    crm: "crm",
    "lead-source": "lead-source",
    "follow-ups": "follow-ups",
    assistant: "assistant",
    customers: "customers",
    reports: "reports",
    integrations: "integrations",
  };
  return routes[path.join("/")] ?? null;
}

export default async function SalesPage({ params, searchParams }: SalesPageProps) {
  const [{ path }, search] = await Promise.all([params, searchParams]);
  const view = resolveView(path);
  if (!view) notFound();
  const page = Number(first(search.page));
  return (
    <SalesWorkspace
      view={view}
      initialQuery={first(search.q) ?? ""}
      initialStatus={first(search.status) ?? ""}
      initialPage={Number.isInteger(page) && page > 0 ? page : 1}
    />
  );
}
