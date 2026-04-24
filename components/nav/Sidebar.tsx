"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Navigation items.
// History:
// - 2026-04-13: Patterns→Precedents, Recipes→Signals (#121).
// - 2026-04-16: Dashboard renamed to BASE and promoted to the top slot (#248).
//   "Base" is QGI's command-center landing — a sample of everything in one view —
//   not a "dashboard of legacy panels." Routed at /base; /dashboard kept as a
//   redirect for outstanding bookmarks.
// - 2026-04-17: Unicode placeholder icons replaced with inline SVGs (#icon-redesign).

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

// ─────────────────────────────────────────────────────────────────────────────

// 2026-04-19: "ABOUT" removed from the dashboard sidebar per user — About
// is a public marketing surface and lives in the landing-page header nav,
// not mixed with dashboard tools. The IconUser SVG was dropped with it.
const NAV_ITEMS: ReadonlyArray<{
  label: string;
  href: string;
  icon: React.ReactNode;
}> = [
  {
    label: "DASHBOARD",
    href: "/dashboard",
    icon: <IconDashboard />,
  },
  {
    label: "COUNTRIES",
    href: "/countries",
    icon: <IconGlobe />,
  },
  {
    label: "PRECEDENTS",
    href: "/precedents",
    icon: <IconHistory />,
  },
  {
    label: "SIGNALS",
    href: "/signals",
    icon: <IconSignal />,
  },
  {
    label: "PATTERNS",
    href: "/patterns",
    icon: <IconNetwork />,
  },
  {
    label: "RANKING",
    href: "/patterns/ranking",
    icon: <IconBarChart />,
  },
];

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

      <aside
        id="qgi-sidebar-drawer"
        className={`flex flex-col w-56 shrink-0 border-r fixed md:static inset-y-0 left-0 z-50 transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
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
          naive startsWith() matches both. The per-item `active` check below
          picks the deepest NAV_ITEMS href that the current pathname matches. */}
        <nav className="flex flex-col gap-0.5 px-2 pt-4 flex-1">
          {NAV_ITEMS.map(({ label, href, icon }) => {
            const active =
              pathname === href ||
              (pathname.startsWith(href + "/") &&
                !NAV_ITEMS.some(
                  (other) =>
                    other.href !== href &&
                    other.href.length > href.length &&
                    (pathname === other.href || pathname.startsWith(other.href + "/"))
                ));
            return (
              <Link
                key={href}
                href={href}
                onClick={closeOnNavigate}
                className="flex items-center gap-3 px-3 py-2.5 rounded text-xs tracking-widest transition-colors"
                style={{
                  color: active ? "var(--qgi-accent)" : "var(--qgi-text-muted)",
                  backgroundColor: active ? "var(--qgi-accent-glow)" : "transparent",
                }}
              >
                <span className="flex items-center justify-center w-4 h-4 shrink-0">
                  {icon}
                </span>
                {label}
              </Link>
            );
          })}
        </nav>

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
