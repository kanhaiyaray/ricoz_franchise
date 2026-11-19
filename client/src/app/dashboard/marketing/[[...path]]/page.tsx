import { notFound } from "next/navigation";
import MarketingWorkspace, {
  type MarketingView,
} from "@/features/marketing/marketing-workspace";

type MarketingPageProps = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveView(path: string[] = []): MarketingView | null {
  const routes: Record<string, MarketingView> = {
    "": "dashboard",
    dashboard: "dashboard",
    work: "work",
    calendar: "calendar",
    approvals: "approvals",
    requests: "requests",
    campaigns: "campaigns",
    content: "content",
    leads: "leads",
    social: "social",
    creative: "creative",
    publishing: "publishing",
    budget: "budget",
    attribution: "attribution",
    analytics: "analytics",
    reports: "reports",
    assistant: "assistant",
  };
  return routes[path.join("/")] ?? null;
}

export default async function MarketingPage({
  params,
  searchParams,
}: MarketingPageProps) {
  const [{ path }, search] = await Promise.all([params, searchParams]);
  const view = resolveView(path);
  if (!view) notFound();
  const page = Number(first(search.page));
  return (
    <MarketingWorkspace
      view={view}
      initialQuery={first(search.q) ?? ""}
      initialStatus={first(search.status) ?? ""}
      initialPage={Number.isInteger(page) && page > 0 ? page : 1}
    />
  );
}
