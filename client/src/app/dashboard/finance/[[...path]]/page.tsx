import { notFound } from "next/navigation";
import FinanceWorkspace, {
  type FinanceView,
} from "@/features/finance/finance-workspace";

type FinancePageProps = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveView(path: string[] = []): {
  view: FinanceView;
  resourceId?: string;
} | null {
  const key = path.join("/");
  const routes: Record<string, FinanceView> = {
    "": "overview",
    "revenue-projections": "revenue",
    "resource-planning": "resources",
    "cost-planning": "costs",
    "financial-summary": "summary",
    "ai-forecast": "forecast",
    billing: "billing",
    "billing/dashboard": "billing",
    "billing/accounting": "accounting",
    "billing/invoices": "invoices",
    "billing/payments": "payments",
  };
  if (routes[key]) return { view: routes[key] };
  if (path.length === 3 && path[0] === "billing" && path[1] === "invoices") {
    return { view: "invoice-detail", resourceId: path[2] };
  }
  if (path.length === 3 && path[0] === "billing" && path[1] === "payments") {
    return { view: "payment-detail", resourceId: path[2] };
  }
  return null;
}

export default async function FinancePage({
  params,
  searchParams,
}: FinancePageProps) {
  const [{ path }, search] = await Promise.all([params, searchParams]);
  const route = resolveView(path);
  if (!route) notFound();

  const yearValue = Number(first(search.fiscalYearStart));
  const pageValue = Number(first(search.page));
  return (
    <FinanceWorkspace
      {...route}
      fiscalYearStart={
        Number.isInteger(yearValue) && yearValue >= 2000 && yearValue <= 2200
          ? yearValue
          : 0
      }
      initialQuery={first(search.q) ?? ""}
      initialStatus={first(search.status) ?? ""}
      initialPage={Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1}
    />
  );
}
