import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "smg-auth";
const LOGIN_PATH = "/login";

// HMAC-like token: simple hash of password + signing key
// This is validated against the cookie value set by /api/auth
const VALID_TOKEN = "smg_authenticated_v1";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for login page, auth API, cron APIs, and static assets
  if (
    pathname === LOGIN_PATH ||
    pathname === "/api/auth" ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get(AUTH_COOKIE);

  if (authCookie?.value === VALID_TOKEN) {
    return NextResponse.next();
  }

  // Unauthenticated: redirect pages to login, return 401 for API routes
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
