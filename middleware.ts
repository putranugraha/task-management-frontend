import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Server-side guard for dashboard pages.
// This app uses bearer tokens. Avoid validating via /api/profile on every
// navigation because that adds a blocking API round-trip to every dashboard request.

const DASHBOARD_PREFIX = "/dashboard";
const LOGIN_PATH = "/auth/login";

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.searchParams.set("next", req.nextUrl.pathname);
  const res = NextResponse.redirect(url);
  res.cookies.set("app_has_token", "", { maxAge: 0, path: "/" });
  res.cookies.set("app_access_token", "", { maxAge: 0, path: "/" });
  res.cookies.set("app_token_type", "", { maxAge: 0, path: "/" });
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith(DASHBOARD_PREFIX)) {
    return NextResponse.next();
  }

  const hasTokenFlag = req.cookies.get("app_has_token")?.value === "1";
  const rawAccessToken = req.cookies.get("app_access_token")?.value || "";
  const accessToken = (() => {
    try {
      return decodeURIComponent(rawAccessToken);
    } catch {
      return rawAccessToken;
    }
  })();

  if (!hasTokenFlag || !accessToken) {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
