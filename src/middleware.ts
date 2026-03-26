import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and API auth routes
  if (
    pathname === "/dashboard/login" ||
    pathname === "/dashboard/api/auth/login" ||
    pathname === "/dashboard/api/health" ||
    pathname.startsWith("/dashboard/_next") ||
    pathname.startsWith("/dashboard/favicon")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("atlas-session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/dashboard/login", request.url));
  }

  // Basic JWT structure check (full verify happens in API routes)
  const parts = token.split(".");
  if (parts.length !== 3) {
    return NextResponse.redirect(new URL("/dashboard/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
