/**
 * /patterns/[slug] — per-pattern detail.
 *
 * 2026-05-31 (founder): the per-pattern detail was built on MOCK SCDIs
 * (lib/cascade-patterns/scdi-mock.ts) pending the backend SCDI batch. Until
 * that real batch lands, this route redirects to the /patterns search so no
 * mock detail is ever shown (zero mocks). The /patterns search itself is real
 * (country-partners-index.json + ranking.json).
 *
 * To restore the detail when real SCDIs ship (data/cascade/pattern-scdis.json):
 *   - recover the mock-dispatch version from git history of this file,
 *   - point it at the real data instead of scdi-mock,
 *   - re-wrap the PatternsSearch result rows in their <Link> (see the comment
 *     in components/patterns-v4/PatternsSearch.tsx).
 */
import { redirect } from "next/navigation";

export default function PatternDetailPage() {
  redirect("/patterns");
}
