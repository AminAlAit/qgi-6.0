"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Navigation items — updated for the Country Intelligence Browser launch.
// Naming: Patterns → Precedents, Recipes → Signals (#121).
// Countries added as first item; COUNTRY PROFILE removed (replaced by /countries/[id]).
// Navigation: Precedents (country+category combos), Signals (category archetypes),
// Countries (all country profiles), then existing tools.
const NAV_ITEMS = [
  {
    label: "PRECEDENTS",
    href: "/countries",
    icon: "▲",
  },
  {
    label: "SIGNALS",
    href: "/signals-browse",
    icon: "◈",
  },
  {
    label: "DASHBOARD",
    href: "/dashboard",
    icon: "▦",
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
      {/* Wordmark */}
      <div
        className="flex items-center gap-2 px-5 py-5 border-b"
        style={{ borderColor: "var(--qgi-border)" }}
      >
        <span
          className="font-data text-xs tracking-[0.25em] font-semibold"
          style={{ color: "var(--qgi-accent)" }}
        >
          QGI
        </span>
        <span
          className="text-[10px] tracking-widest uppercase"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          Intelligence
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-2 pt-4 flex-1">
        {NAV_ITEMS.map(({ label, href, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
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
