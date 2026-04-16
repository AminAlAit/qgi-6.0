import { redirect } from "next/navigation";

/**
 * Legacy /dashboard route. Redirects to the new /base command center
 * landing page (#248 — Dashboard renamed to "Base" and revamped to be the
 * top sidebar selection).
 *
 * Kept as a redirect so any external bookmarks, embedded screenshots, or
 * old article links to /dashboard still resolve.
 */
export default function LegacyDashboardPage() {
  redirect("/base");
}
