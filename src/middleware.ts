import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // With basePath: '/dashboard', pathname does NOT include /dashboard prefix
  // Allow login page, API routes, static assets
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("atlas-session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/dashboard/login", request.url));
  }

  // Basic JWT structure check
  const parts = token.split(".");
  if (parts.length !== 3) {
    return NextResponse.redirect(new URL("/dashboard/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
