import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 Proxy (replaces middleware.ts).
 *
 * Protects the 9 canonical V4.1 app routes behind auth.
 * Landing page (/) is always public.
 *
 * SKIP_AUTH=true bypasses all auth checks for local development.
 */
export function proxy(request: NextRequest) {
  // Dev mode: skip all auth
  if (process.env.SKIP_AUTH === "true") {
    return NextResponse.next();
  }

  // Check for NextAuth session cookie
  const sessionCookie =
    request.cookies.get("__Secure-authjs.session-token") ??
    request.cookies.get("authjs.session-token");

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/recipes/:path*",
    "/countries/:path*",
    "/risk-board/:path*",
    "/compound-risk/:path*",
    "/compare/:path*",
    "/nearest-analog/:path*",
    "/patterns/:path*",
    "/recipe-tracker/:path*",
  ],
};
