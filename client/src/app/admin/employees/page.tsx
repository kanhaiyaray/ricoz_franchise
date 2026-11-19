import EmployeeManagement from "@/features/admin/employee-management";

type EmployeePageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function EmployeePage({
  searchParams,
}: EmployeePageProps) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] : params.q;
  return <EmployeeManagement key={query} initialQuery={query ?? ""} />;
}
