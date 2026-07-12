/**
 * Post-auth redirect guard (CWE-601 open-redirect prevention).
 *
 * The auth forms sign in with `redirect: false`, which opts out of NextAuth's
 * own same-origin `redirect()` callback, then navigate manually to the
 * `callbackUrl` query param. That param is attacker-controllable
 * (`/login?callbackUrl=https://evil.example/reverify`), so it MUST be
 * constrained to a same-origin relative path before we navigate to it.
 *
 * Only a leading single "/" (not "//", which is protocol-relative and would
 * navigate off-origin) is accepted; anything else falls back to /dashboard.
 */
export function safeCallbackUrl(
  raw: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!raw) return fallback;
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}
