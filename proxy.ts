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
    "/trends/:path*",
    // Gate the country profile while leaving the public Live Pulse terminal at
    // /countries/:iso/live-pulse open. Per the Next.js 16 proxy matcher rules,
    // a named param matches exactly ONE segment (rule 2: "/countries/:iso" hits
    // /countries/IRN but NOT /countries/IRN/live-pulse). We deliberately do NOT
    // add a bare "/countries": rule 5 makes bare paths start-anchored, so it
    // would also catch /countries/IRN/live-pulse and re-gate the terminal. The
    // country *list* page is non-sensitive and left ungated as the safe tradeoff.
    "/countries/:iso",
    "/risk-board/:path*",
    "/compound-risk/:path*",
    "/compare/:path*",
    "/analogues/:path*",
    "/patterns/:path*",
  ],
};
