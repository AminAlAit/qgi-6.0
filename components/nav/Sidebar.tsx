"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Navigation items.
// History:
// - 2026-04-13: Patterns→Precedents, Recipes→Signals (#121).
// - 2026-04-16: Dashboard renamed to BASE and promoted to the top slot (#248).
//   "Base" is QGI's command-center landing — a sample of everything in one view —
//   not a "dashboard of legacy panels." Routed at /base; /dashboard kept as a
//   redirect for outstanding bookmarks.
const NAV_ITEMS = [
  {
    label: "BASE",
    href: "/base",
    icon: "◆",
  },
  {
    label: "PRECEDENTS",
    href: "/precedents",
    icon: "▲",
  },
  {
    label: "SIGNALS",
    href: "/signals-browse",
    icon: "◈",
  },
  {
    label: "PATTERNS",
    href: "/patterns",
    icon: "◉",
  },
  {
    label: "RANKING",
    href: "/patterns/ranking",
    icon: "⊕",
  },
] as const;

// UX prototype pages — example implementations of the Sonnet UX consult
// redesigns (2026-04-16). These are NOT live pages; they show hardcoded
// sample data to demonstrate the proposed layouts before implementation.
const EXAMPLE_ITEMS = [
  {
    label: "PRECEDENT V2",
    href: "/examples/precedent-v2",
    icon: "\u25C7", // ◇
  },
  {
    label: "COUNTRY V2",
    href: "/examples/country-v2",
    icon: "\u25C7", // ◇
  },
  {
    label: "PATTERN V2",
    href: "/examples/pattern-v2",
    icon: "\u25C7", // ◇
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col w-56 shrink-0 border-r"
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
          GH#251: clickable; in-app sidebar always navigates to /base. */}
      <Link
        href="/base"
        className="flex items-baseline gap-1 px-5 py-5 border-b transition-colors hover:bg-[var(--qgi-surface-2)]"
        style={{ borderColor: "var(--qgi-border)" }}
        title="Go to Base (command center)"
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
          naive startsWith() matches both. activeHref picks the deepest
          NAV_ITEMS href that the current pathname matches. */}
      {(() => null)()}
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
              className="flex items-center gap-3 px-3 py-2.5 rounded text-xs tracking-widest transition-colors"
              style={{
                color: active ? "var(--qgi-accent)" : "var(--qgi-text-muted)",
                backgroundColor: active ? "var(--qgi-accent-glow)" : "transparent",
              }}
            >
              <span className="text-base leading-none w-4 text-center">{icon}</span>
              {label}
            </Link>
          );
        })}

        {/* ---- Examples divider + links ---- */}
        <div
          className="mt-4 pt-3 mx-3 border-t"
          style={{ borderColor: "var(--qgi-border)" }}
        >
          <span
            className="block px-3 pb-2 text-[9px] tracking-[0.2em] uppercase"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            EXAMPLES
          </span>
          {EXAMPLE_ITEMS.map(({ label, href, icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2 rounded text-xs tracking-widest transition-colors"
                style={{
                  color: active ? "var(--qgi-accent)" : "var(--qgi-text-dim)",
                  backgroundColor: active ? "var(--qgi-accent-glow)" : "transparent",
                }}
              >
                <span className="text-base leading-none w-4 text-center">{icon}</span>
                {label}
              </Link>
            );
          })}
        </div>
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
  );
}
