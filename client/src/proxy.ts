import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PATHS = [
  "/dashboard",
  "/chat",
  "/admin",
  "/franchise",
  "/investor",
  "/customer",
  "/employee",
  "/intern",
];

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const refreshToken = req.cookies.get(
    "refresh_token"
  )?.value;

  const isProtected = PROTECTED_PATHS.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(`${path}/`)
  );

  if (isProtected && !refreshToken) {
    const loginUrl = new URL("/login", req.url);
    const portal = pathname.startsWith("/admin") ? "admin" : "franchise";

    loginUrl.searchParams.set(
      "redirect",
      pathname
    );
    loginUrl.searchParams.set("portal", portal);

    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/chat/:path*",
    "/admin/:path*",
    "/franchise/:path*",
    "/investor/:path*",
    "/customer/:path*",
    "/employee/:path*",
    "/intern/:path*",
  ],
};
