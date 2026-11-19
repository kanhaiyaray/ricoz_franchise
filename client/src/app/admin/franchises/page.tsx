import FranchiseList from "@/features/admin/franchise-list";

type FranchiseListRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FranchiseListRoute({
  searchParams,
}: FranchiseListRouteProps) {
  const params = await searchParams;
  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  const status = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  return <FranchiseList initialQuery={q} initialStatus={status} />;
}
