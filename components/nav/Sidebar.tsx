"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Route } from "next";

// Navigation items.
// History:
// - 2026-04-13: Patterns→Precedents, Recipes→Signals (#121).
// - 2026-04-16: Dashboard renamed to BASE and promoted to the top slot (#248).
//   "Base" is QGI's command-center landing — a sample of everything in one view —
//   not a "dashboard of legacy panels." Routed at /base; /dashboard kept as a
//   redirect for outstanding bookmarks.
// - 2026-04-17: Unicode placeholder icons replaced with inline SVGs (#icon-redesign).
// - 2026-05-15: Flat 5-entry restructure (PR-i of resurfacing cutover). V1 +
//   V2 family sub-entries removed from the sidebar — the routes remain
//   reachable by direct URL but are no longer surfaced in nav. The 4 family
//   entries point at the (current-name) `-merged` routes; PR-iii will rename
//   those to canonical (`/countries`, etc.) atomically with the V1→`-v1`
//   rename, so the sidebar hrefs here will update one more time then.

// ── Inline SVG icons (16×16, currentColor, no external deps) ──────────────

/** DASHBOARD — 2×2 grid of squares: command-center overview */
const IconDashboard = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect
      x="1"
      y="1"
      width="6"
      height="6"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="9"
      y="1"
      width="6"
      height="6"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="1"
      y="9"
      width="6"
      height="6"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="9"
      y="9"
      width="6"
      height="6"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

/** COUNTRIES — wireframe globe with meridian + equator lines */
const IconGlobe = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
    {/* vertical meridian */}
    <path
      d="M8 1.75C8 1.75 5.5 4.5 5.5 8s2.5 6.25 2.5 6.25M8 1.75C8 1.75 10.5 4.5 10.5 8S8 14.25 8 14.25"
      stroke="currentColor"
      strokeWidth="1.25"
    />
    {/* horizontal equator */}
    <line x1="1.75" y1="8" x2="14.25" y2="8" stroke="currentColor" strokeWidth="1.25" />
  </svg>
);

/** PRECEDENTS — clock with a counter-clockwise arrow: look back in history */
const IconHistory = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 14A6 6 0 1 0 2.5 7.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* CCW arrow tip on the arc's open end */}
    <polyline
      points="1,5.5 2.5,7.5 4.5,6.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* clock hands: 12 o'clock stem + 3 o'clock hand */}
    <line
      x1="8"
      y1="8"
      x2="8"
      y2="5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="8"
      y1="8"
      x2="11"
      y2="8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/** SIGNALS — lightning bolt: alert / early-warning signal */
const IconSignal = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M9.5 1.5L4 9h4l-1.5 5.5L12 7H8L9.5 1.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** PATTERNS — three nodes connected by edges: network / structural pattern */
const IconNetwork = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    {/* edges */}
    <line x1="8" y1="3" x2="3" y2="12" stroke="currentColor" strokeWidth="1.25" />
    <line x1="8" y1="3" x2="13" y2="12" stroke="currentColor" strokeWidth="1.25" />
    <line x1="3" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1.25" />
    {/* nodes */}
    <circle cx="8" cy="3" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="3" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="13" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/** RANKING — ascending bar chart: power ranking / leaderboard */
const IconBarChart = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect
      x="1.5"
      y="9"
      width="3"
      height="5.5"
      rx="0.5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="6.5"
      y="5.5"
      width="3"
      height="9"
      rx="0.5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="11.5"
      y="1.5"
      width="3"
      height="13"
      rx="0.5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

/** CHEF'S HAT — Sofia V4.1 pick for "Recipes" (Charter §3 methodology unit).
 *  Reads as recipe-author in one glance; doesn't compete with L1-family
 *  crisis iconography on the recipe cards. Replaces the prior clock-with-
 *  CCW-arrow ("look back in history") which mis-cued when the page label
 *  swapped from "Precedents" → "Recipes". 16×16 hat outline. */
const IconChefHat = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    {/* Hat crown — three lobes (left/center/right pillows) */}
    <path
      d="M3.25 7.5a2 2 0 1 1 1.2-3.6 2.5 2.5 0 0 1 4.6-1.4 2.5 2.5 0 0 1 4.6 1.4 2 2 0 1 1 1.2 3.6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Hat band */}
    <line
      x1="3.25"
      y1="7.5"
      x2="13.05"
      y2="7.5"
      stroke="currentColor"
      strokeWidth="1.25"
    />
    {/* Pleats — three short verticals on the band */}
    <line x1="6" y1="8" x2="6" y2="10.5" stroke="currentColor" strokeWidth="1" />
    <line x1="8.15" y1="8" x2="8.15" y2="10.5" stroke="currentColor" strokeWidth="1" />
    <line x1="10.3" y1="8" x2="10.3" y2="10.5" stroke="currentColor" strokeWidth="1" />
    {/* Brim */}
    <rect
      x="3"
      y="10.5"
      width="10.3"
      height="2.25"
      rx="0.5"
      stroke="currentColor"
      strokeWidth="1.25"
    />
  </svg>
);

/** BEAKER — wide-mouth lab beaker with bubbling liquid: experimental / mockup
 *  section header. Marks routes that are local-only and not production-bound. */
const IconBeaker = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    {/* Lip */}
    <line
      x1="5"
      y1="2"
      x2="11"
      y2="2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Walls — narrow neck flaring to wider base */}
    <path
      d="M6 2v3.5L2.75 12.5a1 1 0 0 0 .9 1.5h8.7a1 1 0 0 0 .9-1.5L10 5.5V2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {/* Liquid line */}
    <line x1="3.4" y1="11" x2="12.6" y2="11" stroke="currentColor" strokeWidth="1.25" />
    {/* Bubble */}
    <circle cx="6.5" cy="9.5" r="0.6" fill="currentColor" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────

// 2026-04-19: "ABOUT" removed from the dashboard sidebar per user — About
// is a public marketing surface and lives in the landing-page header nav,
// not mixed with dashboard tools. The IconUser SVG was dropped with it.
//
// #440: `href: Route` so typed-routes pre-validates every nav target at
// build time. Renaming `/precedents` → `/precedence` (or any future
// re-org) becomes a build error here instead of a 404 in production.
//
// 2026-05-13 (A3 Family 1 Build PR #4): refactored from flat 15-item nav
// into family-grouped sections with chip badges (LIVE / PREVIEW). The
// merged Precedents preview surface needed its own nav slot (founder
// request); flat list was already cluttered with 4 V2 routes; grouping
// makes the V1/V2/Merged side-by-side comparison legible. Chip badges
// surface the trial-period state at a glance. Cutover (PR #5) will kill
// V1 + V2 preview entries and promote the merged route to PRIMARY status.

/** Trial-period status chip. PRIMARY is reserved for the post-cutover
 *  canonical surface; LIVE = production V1; PREVIEW = V2 + merged previews. */
type NavBadge = "LIVE" | "PREVIEW" | "PRIMARY";

interface NavItem {
  label: string;
  href: Route;
  badge: NavBadge;
}

interface NavGroup {
  /** Group header label (sentence-case, never tracked uppercase). */
  label: string;
  icon: React.ReactNode;
  items: ReadonlyArray<NavItem>;
}

interface NavStandalone {
  type: "standalone";
  label: string;
  href: Route;
  icon: React.ReactNode;
  badge: NavBadge;
}

type NavEntry = NavGroup | NavStandalone;

/**
 * PR-i of the resurfacing cutover (2026-05-15) — sidebar flattened to a
 * 5-entry top-level list: Dashboard + 4 family canonicals.
 *
 * Legacy V1 (Country browser / Recipe catalogue / Active signals / Pattern
 * atlas / Power ranking) and V2 (Table / Narrative / Tufte / Lloyd's /
 * Discover — Tabs / Discover — Facets) routes are NOT in the sidebar
 * anymore. They remain LIVE in the routing tree — reachable by typing the
 * URL — but are no longer surfaced in nav. PR-iii will rename:
 *   /countries (V1)         → /countries-v1
 *   /countries (V3)  → /countries
 *   (same shape for Precedents / Signals / Patterns)
 * and at that moment the hrefs below flip to the unsuffixed canonical.
 */
const NAV_STRUCTURE: ReadonlyArray<NavEntry> = [
  {
    type: "standalone",
    label: "Dashboard",
    href: "/dashboard",
    icon: <IconDashboard />,
    badge: "LIVE",
  },
  {
    // 2026-05-27 rename: "Precedents" → "Recipes" (Charter §3-aligned).
    // Unanimous SWAP from design council (Sofia + Talia + Daniyar).
    // Sofia V4.1 design pass: icon swap to chef's hat — reads as
    // recipe-author + doesn't compete with L1 crisis iconography.
    type: "standalone",
    label: "Recipes",
    href: "/precedents" as Route,
    icon: <IconChefHat />,
    badge: "LIVE",
  },
  {
    type: "standalone",
    label: "Countries",
    href: "/countries" as Route,
    icon: <IconGlobe />,
    badge: "LIVE",
  },
  {
    type: "standalone",
    label: "Signals",
    href: "/signals" as Route,
    icon: <IconSignal />,
    badge: "LIVE",
  },
  {
    type: "standalone",
    label: "Patterns",
    href: "/patterns" as Route,
    icon: <IconNetwork />,
    badge: "LIVE",
  },
  // 2026-05-26: TE mockup group — local-only preview routes for the
  // Trajectory-Engine site-architecture target-state. NOT in production
  // bundle. Stays on `local/te-precedents-mockup` branch until founder
  // ratifies. Ordered: existing-pages-redesigned first (matching the
  // production sidebar order — Dashboard → Precedents → Countries →
  // Patterns), then the 4 brand-new pages from
  // te-site-architecture-target-state.md §2.
  {
    label: "TE Mockup (local)",
    icon: <IconBeaker />,
    items: [
      { label: "Dashboard V4", href: "/dashboard-v4" as Route, badge: "PREVIEW" },
      { label: "Dashboard V4.1", href: "/dashboard-v4.1" as Route, badge: "PREVIEW" },
      { label: "Recipes V4", href: "/precedents-v2" as Route, badge: "PREVIEW" },
      { label: "Recipes V4.1", href: "/recipes-v4.1" as Route, badge: "PREVIEW" },
      { label: "Countries V4", href: "/countries-v4" as Route, badge: "PREVIEW" },
      { label: "Countries V4.1", href: "/countries-v4.1" as Route, badge: "PREVIEW" },
      { label: "Live Risk Board", href: "/risk-board" as Route, badge: "PREVIEW" },
      { label: "Compound Risk", href: "/compound-risk" as Route, badge: "PREVIEW" },
      { label: "Nearest-Analog", href: "/nearest-analog" as Route, badge: "PREVIEW" },
      { label: "Recipe Tracker", href: "/recipe-tracker" as Route, badge: "PREVIEW" },
    ],
  },
];

/** Flatten the structure to the leaf-route list — used by the
 *  longest-prefix-wins active-state algorithm so a deep pathname like
 *  /precedents/civil_war_and_insurgency highlights the right item. */
function collectNavItems(): NavItem[] {
  const all: NavItem[] = [];
  for (const entry of NAV_STRUCTURE) {
    if ("type" in entry) {
      all.push({ label: entry.label, href: entry.href, badge: entry.badge });
    } else {
      all.push(...entry.items);
    }
  }
  return all;
}

const FLAT_NAV_ITEMS = collectNavItems();

export function Sidebar() {
  const pathname = usePathname();

  // T14 #307 HIGH fix (2026-04-19): mobile hamburger + off-canvas sidebar.
  // Desktop behavior is unchanged — sidebar is always visible at md+ via
  // static positioning. On <md viewports the sidebar slides in from the
  // left as a fixed overlay, with a backdrop that dismisses on click,
  // Escape closes, and body scroll-lock while open.
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer when the user taps a nav link. We used to do this
  // via a `useEffect(() => setMobileOpen(false), [pathname])` effect, but
  // react-hooks/set-state-in-effect flags the unconditional setState as
  // an anti-pattern (cascading renders). The event-handler path is the
  // React-preferred way to close a controlled UI surface on navigation.
  const closeOnNavigate = () => setMobileOpen(false);

  // Escape to dismiss.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile hamburger — only visible <md. Fixed top-left, above the
          drawer's own z-index so it's always tappable. */}
      <button
        type="button"
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileOpen}
        aria-controls="qgi-sidebar-drawer"
        onClick={() => setMobileOpen((v) => !v)}
        className="md:hidden fixed top-3 left-3 z-[60] p-2 rounded border"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
          color: "var(--qgi-text-muted)",
        }}
      >
        {mobileOpen ? (
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 3L13 13M13 3L3 13"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <line
              x1="2.5"
              y1="4"
              x2="13.5"
              y2="4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
            <line
              x1="2.5"
              y1="8"
              x2="13.5"
              y2="8"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
            <line
              x1="2.5"
              y1="12"
              x2="13.5"
              y2="12"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {/* Backdrop — only visible <md when drawer is open. */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          tabIndex={-1}
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/60 animate-in fade-in duration-150"
        />
      )}

      {/* PR-vii (2026-05-15) — aria-label="Site navigation" on the
          landmark wrapper. Pointer-events guard during the slide-in
          transition prevents a click on the hamburger from passing
          through to the link beneath while the drawer is translating
          in (was navigating users to /precedents on mobile tap). */}
      <aside
        id="qgi-sidebar-drawer"
        aria-label="Site navigation"
        className={`flex flex-col w-56 shrink-0 border-r fixed md:static inset-y-0 left-0 z-50 transition-transform duration-200 md:translate-x-0 ${
          mobileOpen
            ? "translate-x-0 pointer-events-auto"
            : "-translate-x-full md:translate-x-0 pointer-events-none md:pointer-events-auto"
        }`}
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        {/* Wordmark — matches the qgintelligence.com domain (#245).
          QG (blue) + INTELLIGENCE (grey) reads as "qg-intelligence" the same
          way the URL does.
          Visual: tightened with `gap-1` + negative margin-right on QG so the
          trailing letter-spacing doesn't push "Intelligence" away (the
          0.25em tracking adds ~3px of phantom space after the last letter).
          GH#251: clickable; in-app sidebar navigates to /dashboard
          (was /base, which just redirects — saves an extra hop per click). */}
        <Link
          href="/dashboard"
          onClick={closeOnNavigate}
          className="flex items-baseline gap-1 px-5 py-5 border-b transition-colors hover:bg-[var(--qgi-surface-2)]"
          style={{ borderColor: "var(--qgi-border)" }}
          title="Go to Dashboard (command center)"
        >
          <span
            className="font-data text-xs tracking-[0.25em] font-semibold"
            style={{ color: "var(--qgi-accent)", marginRight: "-0.25em" }}
          >
            QG
          </span>
          <span
            className="text-[10px] tracking-widest uppercase"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            Intelligence
          </span>
        </Link>

        {/* Navigation
          GH#250: longest-prefix-wins active state. Without this, RANKING
          (/patterns/ranking) ALSO lights up PATTERNS (/patterns) because
          naive startsWith() matches both. `isActiveRoute` picks the
          deepest leaf href that the current pathname matches.
          2026-05-13 (A3 Family 1 PR #4): refactored to family-grouped
          sections; the active-state algorithm operates on the flattened
          leaf list (FLAT_NAV_ITEMS) so it stays unaware of group structure. */}
        <nav
          aria-label="Main navigation"
          className="flex flex-col gap-3 px-2 pt-4 flex-1 overflow-y-auto"
        >
          {NAV_STRUCTURE.map((entry) => {
            if ("type" in entry) {
              return (
                <NavLeafLink
                  key={entry.href}
                  label={entry.label}
                  href={entry.href}
                  icon={entry.icon}
                  badge={entry.badge}
                  pathname={pathname}
                  onClick={closeOnNavigate}
                />
              );
            }
            return (
              <NavGroupSection
                key={entry.label}
                group={entry}
                pathname={pathname}
                onLinkClick={closeOnNavigate}
              />
            );
          })}
        </nav>

        {/* Tour-design 2026-05-18 — manual re-trigger for the in-product
            tour. Sets a localStorage flag and reloads; TourProvider picks
            it up and forces a tour start regardless of the dismiss cookie. */}
        <button
          type="button"
          onClick={() => {
            if (typeof window === "undefined") return;
            window.localStorage.setItem("qgi-tour-launch", "manual");
            window.location.reload();
          }}
          className="mx-3 mb-2 mt-1 px-3 py-2 rounded text-[10px] tracking-widest uppercase font-semibold border transition-colors text-left"
          style={{
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text-muted)",
            backgroundColor: "transparent",
          }}
        >
          ✨ Take the tour
        </button>

        {/* Footer */}
        <div
          className="px-5 py-4 border-t text-[10px] tracking-wider"
          style={{
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text-dim)",
          }}
        >
          QUANTITATIVE
          <br />
          GEOPOLITICAL
          <br />
          INTELLIGENCE
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components for the family-grouped nav (A3 Family 1 PR #4)
// ---------------------------------------------------------------------------

/** Longest-prefix-wins active-state check (per-leaf, group-unaware). */
function isActiveRoute(pathname: string, href: Route): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;
  // A deeper leaf in the same family wins (e.g. /patterns/ranking outranks
  // /patterns when the user is on /patterns/ranking).
  return !FLAT_NAV_ITEMS.some(
    (other) =>
      other.href !== href &&
      other.href.length > href.length &&
      (pathname === other.href || pathname.startsWith(other.href + "/"))
  );
}

/** Top-level nav link (icon + label + badge). PR-i (2026-05-15) flat
 *  restructure made this the renderer for all 5 sidebar entries — the
 *  group/family distinction is gone, so every entry uses this shape. */
function NavLeafLink({
  label,
  href,
  icon,
  pathname,
  onClick,
}: {
  label: string;
  href: Route;
  icon: React.ReactNode;
  badge: NavBadge;
  pathname: string;
  onClick: () => void;
}) {
  const active = isActiveRoute(pathname, href);
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className="flex items-center gap-3 px-3 py-2.5 rounded text-xs tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qgi-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--qgi-surface)]"
      style={{
        color: active ? "var(--qgi-accent)" : "var(--qgi-text-muted)",
        backgroundColor: active ? "var(--qgi-accent-glow)" : "transparent",
      }}
    >
      <span className="flex items-center justify-center w-4 h-4 shrink-0">{icon}</span>
      <span className="flex-1 uppercase">{label}</span>
    </Link>
  );
}

/** Family section header + child links. Non-collapsible in PR #4 — clean
 *  visual grouping without state cost. Collapsible expansion can ship as
 *  a follow-up if founder finds the sidebar too tall. */
function NavGroupSection({
  group,
  pathname,
  onLinkClick,
}: {
  group: NavGroup;
  pathname: string;
  onLinkClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {/* Group header — small uppercase tracked, dim. Icon at left. */}
      <div
        className="flex items-center gap-3 px-3 py-1.5"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        <span className="flex items-center justify-center w-4 h-4 shrink-0">
          {group.icon}
        </span>
        <span className="text-[10px] tracking-widest uppercase font-semibold">
          {group.label}
        </span>
      </div>
      {/* Indented item rows — no per-item icon (group icon does the job). */}
      <div className="flex flex-col gap-0.5">
        {group.items.map((item) => {
          const active = isActiveRoute(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className="flex items-center gap-2 pl-10 pr-3 py-1.5 rounded text-xs tracking-wide transition-colors"
              style={{
                color: active ? "var(--qgi-accent)" : "var(--qgi-text-muted)",
                backgroundColor: active ? "var(--qgi-accent-glow)" : "transparent",
              }}
            >
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Trial-period status chip. Three states:
 *  - LIVE: production V1 surface (neutral slate)
 *  - PREVIEW: V2 + merged-preview routes (amber)
 *  - PRIMARY: reserved for post-cutover canonical surface (blue/accent)
 *
 * #790 (Aisha R5 2026-05-17) — without a tooltip / legend, "LIVE" reads
 * to a first-visit analyst as a meaningless design choice or a hidden-
 * meaning status indicator. Each badge state now carries a one-line
 * `title` so hovering surfaces the meaning. (Pure hover tooltip — no
 * extra DOM, no aria changes; the existing aria-label is preserved.)
 */
const BADGE_TOOLTIP: Record<NavBadge, string> = {
  LIVE: "Production route — current bake data.",
  PREVIEW: "Preview / V2 route — alongside the production surface during cutover.",
  PRIMARY: "Primary canonical surface (post-cutover).",
};

function NavChip({ badge }: { badge: NavBadge }) {
  const colors: Record<NavBadge, { fg: string; bg: string; border: string }> = {
    LIVE: {
      fg: "#94a3b8",
      bg: "rgba(148, 163, 184, 0.12)",
      border: "rgba(148, 163, 184, 0.30)",
    },
    PREVIEW: {
      fg: "#fbbf24",
      bg: "rgba(251, 191, 36, 0.12)",
      border: "rgba(251, 191, 36, 0.35)",
    },
    PRIMARY: {
      fg: "var(--qgi-accent)",
      bg: "var(--qgi-accent-glow)",
      border: "var(--qgi-accent)",
    },
  };
  const c = colors[badge];
  return (
    <span
      className="inline-flex items-center font-data text-[8px] tracking-widest uppercase px-1 py-0.5 rounded font-semibold shrink-0"
      style={{
        color: c.fg,
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
      }}
      // Keep the chip semantic for screen readers but visually compact.
      aria-label={`${badge} surface`}
      title={BADGE_TOOLTIP[badge]}
    >
      {badge}
    </span>
  );
}
