import ActivationPage from "@/features/auth/activation-page";

type ActivationRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ActivationRoute({
  searchParams,
}: ActivationRouteProps) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] ?? "" : params.token ?? "";
  return <ActivationPage token={token} />;
}
