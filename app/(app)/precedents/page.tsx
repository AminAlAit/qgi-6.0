/**
 * /precedents — landing for the PRECEDENTS sidebar item (GH#253).
 *
 * GH#253 phase 1: keep the existing /countries grid as the landing
 * destination so the link works immediately while the dedicated
 * /precedents page is being designed (per #14 EA-FC cards + #248
 * country page enrichment).
 *
 * GH#253 phase 2 (separate ticket): build a precedent-window-first
 * grid here that sorts by salience density across all (country, category)
 * combinations.
 *
 * For now this just redirects to /countries so users hit the existing
 * grid. The phase 2 work will replace this page in place.
 */
import { redirect } from "next/navigation";

export default function PrecedentsPage() {
  redirect("/countries");
}
