import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Server-side guard for dashboard pages.
// Uses token cookies or Sanctum session cookies, then validates via /api/profile.

const DASHBOARD_PREFIX = "/dashboard";
const LOGIN_PATH = "/auth/login";
const PROFILE_PATH = "/api/profile";

function getApiBaseUrl() {
  const internal = process.env.INTERNAL_API_BASE_URL;
  const publicBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const publicUrl = process.env.NEXT_PUBLIC_API_URL;
  return (
    internal ||
    publicBase ||
    publicUrl ||
    (process.env.NODE_ENV === "production"
      ? "https://api.centralsagamandala.com"
      : "http://localhost:8000")
  );
}

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

  const accessToken = req.cookies.get("app_access_token")?.value || "";
  const tokenType = req.cookies.get("app_token_type")?.value || "Bearer";
  const hasSanctum = Boolean(
    req.cookies.get("XSRF-TOKEN")?.value ||
    req.cookies.get("laravel_session")?.value
  );

  if (!accessToken && !hasSanctum) {
    return redirectToLogin(req);
  }

  const headers = new Headers();
  headers.set("Accept", "application/json");
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }
  if (accessToken) {
    headers.set("Authorization", `${tokenType} ${accessToken}`);
  }

  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(new URL(PROFILE_PATH, baseUrl), {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (res.ok) {
      return NextResponse.next();
    }
    return redirectToLogin(req);
  } catch {
    return redirectToLogin(req);
  }
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
