"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Route } from "next";
import {
  LayoutDashboard,
  ScrollText,
  Globe,
  Gauge,
  Layers,
  Columns2,
  Telescope,
  Waves,
  ListChecks,
} from "lucide-react";

// Navigation items.
// History:
// - 2026-04-13: Patterns→Precedents, Recipes→Signals (#121).
// - 2026-04-16: Dashboard renamed to BASE and promoted to the top slot (#248).
// - 2026-04-17: Unicode placeholder icons replaced with inline SVGs (#icon-redesign).
// - 2026-05-15: Flat 5-entry restructure (PR-i of resurfacing cutover).
// - 2026-05-28: V4.1 canonical promotion. TE Mockup group merged into the
//   top-level list as 9 standalone PRIMARY entries. All legacy entries
//   (Dashboard/Recipes/Countries/Signals/Patterns pointing at deleted routes)
//   removed. Inline SVG icon components removed; lucide-react used directly.

// ─────────────────────────────────────────────────────────────────────────────

// #440: `href: Route` so typed-routes pre-validates every nav target at
// build time. A typo in any internal route becomes a build failure instead
// of a silent runtime 404.

/** Nav badge type. PRIMARY = canonical post-cutover surface. */
type NavBadge = "LIVE" | "PREVIEW" | "PRIMARY";

interface NavItem {
  label: string;
  href: Route;
  badge: NavBadge;
  /** Optional per-item icon rendered next to the label inside a group. */
  icon?: React.ReactNode;
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
 * 2026-05-28 — V4.1 canonical promotion.
 *
 * The legacy 5-entry top-level list (Dashboard/Recipes/Countries/Signals/
 * Patterns pointing at deleted V3 routes) and the TE Mockup group (9 V4.1
 * routes behind a beaker section header) collapse into ONE flat list of
 * 9 PRIMARY canonical entries. Labels drop the "V4" / "V4.1" suffixes.
 * Icons: lucide-react throughout — no inline SVGs needed.
 */
const NAV_STRUCTURE: ReadonlyArray<NavEntry> = [
  {
    type: "standalone",
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard size={16} strokeWidth={1.5} aria-hidden="true" />,
    badge: "PRIMARY",
  },
  {
    type: "standalone",
    label: "Recipes",
    href: "/recipes",
    icon: <ScrollText size={16} strokeWidth={1.5} aria-hidden="true" />,
    badge: "PRIMARY",
  },
  {
    type: "standalone",
    label: "Countries",
    href: "/countries",
    icon: <Globe size={16} strokeWidth={1.5} aria-hidden="true" />,
    badge: "PRIMARY",
  },
  {
    type: "standalone",
    label: "Risk Board",
    href: "/risk-board",
    icon: <Gauge size={16} strokeWidth={1.5} aria-hidden="true" />,
    badge: "PRIMARY",
  },
  {
    type: "standalone",
    label: "Compound Risk",
    href: "/compound-risk",
    icon: <Layers size={16} strokeWidth={1.5} aria-hidden="true" />,
    badge: "PRIMARY",
  },
  {
    type: "standalone",
    label: "Compare",
    href: "/compare",
    icon: <Columns2 size={16} strokeWidth={1.5} aria-hidden="true" />,
    badge: "PRIMARY",
  },
  {
    type: "standalone",
    label: "Nearest Analog",
    href: "/nearest-analog",
    icon: <Telescope size={16} strokeWidth={1.5} aria-hidden="true" />,
    badge: "PRIMARY",
  },
  {
    type: "standalone",
    label: "Patterns",
    href: "/patterns",
    icon: <Waves size={16} strokeWidth={1.5} aria-hidden="true" />,
    badge: "PRIMARY",
  },
  {
    type: "standalone",
    label: "Recipe Tracker",
    href: "/recipe-tracker",
    icon: <ListChecks size={16} strokeWidth={1.5} aria-hidden="true" />,
    badge: "PRIMARY",
  },
];

/** Flatten the structure to the leaf-route list — used by the
 *  longest-prefix-wins active-state algorithm so a deep pathname like
 *  /recipes/foreign_intervention highlights the right item. */
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
          in (was navigating users to /recipes on mobile tap). */}
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
          className="flex items-baseline gap-1.5 px-5 py-6 border-b transition-colors hover:bg-[var(--qgi-surface-2)]"
          style={{ borderColor: "var(--qgi-border)" }}
          title="Go to Dashboard (command center)"
        >
          <span
            style={{
              fontSize: "26px",
              lineHeight: 1,
              letterSpacing: "0.04em",
              color: "var(--qgi-accent)",
              marginRight: "-0.05em",
              // 2026-05-28 (founder pick): use Century Gothic Bold for the QG
              // wordmark — matches the Gemini infographics. Fallback chain:
              // Century Gothic (Windows native), URW Gothic (Linux), Avant
              // Garde / Geometric Sans (macOS fallbacks), Sora (the
              // previous web brand font), then generic sans.
              fontFamily:
                "'Century Gothic', 'CenturyGothic', 'URW Gothic', 'AppleGothic', 'ITC Avant Garde Gothic', var(--font-qg-brand), sans-serif",
              fontWeight: 700,
            }}
          >
            QG
          </span>
          <span
            className="uppercase"
            style={{
              fontSize: "12px",
              letterSpacing: "0.2em",
              color: "var(--qgi-text-muted)",
              fontWeight: 500,
            }}
          >
            Intelligence
          </span>
        </Link>

        {/* Navigation
          GH#250: longest-prefix-wins active state. Without this, RECIPE-TRACKER
          (/recipe-tracker) could mis-activate RECIPES (/recipes) because a naive
          startsWith() would match both. `isActiveRoute` picks the deepest leaf
          href that the current pathname matches.
          2026-05-28: all 9 entries are standalone; NavGroupSection is still
          supported by the renderer for future use but not currently in the
          structure. */}
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
// Sub-components
// ---------------------------------------------------------------------------

/** Longest-prefix-wins active-state check (per-leaf, group-unaware). */
function isActiveRoute(pathname: string, href: Route): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;
  // A deeper leaf in the same family wins (e.g. /recipes/foreign_intervention
  // outranks /recipes when the user is on a recipe detail page).
  return !FLAT_NAV_ITEMS.some(
    (other) =>
      other.href !== href &&
      other.href.length > href.length &&
      (pathname === other.href || pathname.startsWith(other.href + "/"))
  );
}

/** Top-level nav link (icon + label). Used for all 9 canonical entries. */
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

/** Family section header + child links. Non-collapsible — clean visual
 *  grouping without state cost. Kept for future use; not in current
 *  NAV_STRUCTURE after the V4.1 canonical promotion. */
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
      {/* Indented item rows — per-item icon rendered when present. */}
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
              {item.icon && (
                <span className="flex items-center justify-center w-[14px] h-[14px] shrink-0">
                  {item.icon}
                </span>
              )}
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
