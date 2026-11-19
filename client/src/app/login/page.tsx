import { LoginPage } from "@/features/auth/auth-pages";
import type { UserPortal } from "@/services/types/auth.types";

type LoginRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginRoute({ searchParams }: LoginRouteProps) {
  const params = await searchParams;
  const portalParam = Array.isArray(params.portal) ? params.portal[0] : params.portal;
  const emailParam = Array.isArray(params.email) ? params.email[0] : params.email;
  const redirectParam = Array.isArray(params.redirect)
    ? params.redirect[0]
    : params.redirect;
  const portal: UserPortal = portalParam === "admin" ? "admin" : "franchise";

  return (
    <LoginPage
      initialPortal={portal}
      initialEmail={emailParam}
      redirectTo={redirectParam}
    />
  );
}
