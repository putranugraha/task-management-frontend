import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Basic client-token presence middleware.
// Note: since token is stored in localStorage, middleware cannot read it.
// We rely on a lightweight cookie flag set on login (app_has_token=1)
// and, when using Sanctum, presence of common cookies.

const DASHBOARD_PREFIX = "/dashboard";
const LOGIN_PATH = "/auth/login";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith(DASHBOARD_PREFIX)) {
    return NextResponse.next();
  }

  const hasFlag = req.cookies.get("app_has_token")?.value === "1";
  const hasSanctum = Boolean(
    req.cookies.get("XSRF-TOKEN")?.value ||
    req.cookies.get("laravel_session")?.value
  );

  if (hasFlag || hasSanctum) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};

