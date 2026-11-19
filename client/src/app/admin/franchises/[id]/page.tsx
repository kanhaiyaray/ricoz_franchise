import FranchiseDetail from "@/features/admin/franchise-detail";

type FranchiseDetailRouteProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FranchiseDetailRoute({
  params,
  searchParams,
}: FranchiseDetailRouteProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  return <FranchiseDetail id={id} initialTab={tab} />;
}
