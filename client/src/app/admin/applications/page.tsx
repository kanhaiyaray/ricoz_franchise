import ApplicationManagement from "@/features/admin/application-management";

type ApplicationsPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function ApplicationsPage({
  searchParams,
}: ApplicationsPageProps) {
  const { q = "" } = await searchParams;
  return <ApplicationManagement key={q} initialQuery={q} />;
}
