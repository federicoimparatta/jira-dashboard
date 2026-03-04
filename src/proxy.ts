import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "dash-auth";
const LOGIN_PATH = "/login";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for login page, auth API, setup page, cron APIs, and static assets
  if (
    pathname === LOGIN_PATH ||
    pathname === "/api/auth" ||
    pathname === "/setup" ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get(AUTH_COOKIE);

  if (authCookie?.value === "authenticated") {
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
