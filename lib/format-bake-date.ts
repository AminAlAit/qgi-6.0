/**
 * Format an ISO date (YYYY-MM-DD) as a user-facing "data through Month YYYY"
 * string. Used in page footers + status chips to communicate data vintage
 * without exposing internal bake terminology.
 *
 * Gates-doc Rank 5 (Fatima R1-R3, James R3, Marcus R3, Dmitri R3, Santiago
 * R3 — 5 cross-persona convergence): "Bake 2026-04-30" reads as engineer
 * jargon; "Data through April 2026" reads as a journalist/analyst input.
 *
 * Examples:
 *   "2026-04-30" → "April 2026"
 *   "2025-12-15" → "December 2025"
 *   "bad input"  → "" (caller decides the fallback)
 */
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function formatBakeMonthYear(iso: string | undefined | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const year = m[1];
  const monthIdx = parseInt(m[2], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return "";
  return `${MONTHS[monthIdx]} ${year}`;
}

/**
 * Compose the "Data through {Month YYYY}" label used in status chips +
 * page footers. Falls back to "Data vintage unknown" if the input is bad.
 */
export function formatDataThrough(iso: string | undefined | null): string {
  const monthYear = formatBakeMonthYear(iso);
  return monthYear ? `Data through ${monthYear}` : "Data vintage unknown";
}
