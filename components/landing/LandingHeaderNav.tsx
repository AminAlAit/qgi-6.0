"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * #427: landing-page header nav with mobile hamburger.
 *
 * Desktop (>=md): all links inline as before.
 * Mobile (<md): Methodology, About, Open Dashboard stay visible; Reports,
 * Blog, Contact move into a hamburger dropdown. Previous design (per the
 * comment at `app/page.tsx:165-174`) hid Reports/Blog/Contact on mobile
 * with NO fallback — making them unreachable from a phone. Today's QA
 * sweep confirmed this was the #1 mobile regression.
 *
 * Kept as a small client component; the parent `app/page.tsx` is still
 * a server component (ISR + revalidate) and imports this for the nav
 * block only.
 */
export function LandingHeaderNav() {
  const [open, setOpen] = useState(false);

  // Close the menu on Escape + on route change (click of a link).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeOnNav = () => setOpen(false);

  const linkBase =
    "text-[10px] sm:text-xs tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]";
  const linkStyle = { color: "var(--qgi-text-muted)" };

  return (
    <nav className="flex items-center gap-3 sm:gap-6 relative">
      {/* Desktop-only links: Reports, Blog, Contact */}
      <Link
        href="/reports"
        className={`hidden md:inline-flex ${linkBase}`}
        style={linkStyle}
      >
        Reports
      </Link>

      {/* Always-visible: Methodology, About */}
      <Link href="/methodology" className={linkBase} style={linkStyle}>
        Methodology
      </Link>
      <Link href="/about" className={linkBase} style={linkStyle}>
        About
      </Link>

      <Link
        href="/blog"
        className={`hidden md:inline-flex ${linkBase}`}
        style={linkStyle}
      >
        Blog
      </Link>
      <a
        href="#contact"
        className={`hidden md:inline-flex ${linkBase}`}
        style={linkStyle}
      >
        Contact
      </a>

      <Link
        href="/dashboard"
        className="text-[10px] sm:text-xs tracking-wider uppercase px-3 sm:px-4 py-1.5 sm:py-2 rounded transition-colors whitespace-nowrap"
        style={{
          backgroundColor: "var(--qgi-accent)",
          color: "var(--qgi-bg)",
        }}
      >
        Open Dashboard
      </Link>

      {/* Hamburger — visible only on mobile (<md). Exposes Reports, Blog, Contact. */}
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="landing-mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded border transition-colors hover:bg-[var(--qgi-surface-2)]"
        style={{
          borderColor: "var(--qgi-border)",
          color: "var(--qgi-text-muted)",
        }}
      >
        {open ? (
          // X icon
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          // Hamburger icon
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        )}
      </button>

      {/* Mobile dropdown menu. Absolutely positioned under the hamburger
          button. Items are the links hidden on mobile (Reports, Blog,
          Contact). Closes when any link is clicked OR Escape is pressed. */}
      {open && (
        <div
          id="landing-mobile-menu"
          className="md:hidden absolute top-full right-0 mt-2 min-w-[180px] rounded border shadow-lg py-2 z-50"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <Link
            href="/reports"
            onClick={closeOnNav}
            className="block px-4 py-3 text-sm tracking-wider uppercase transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            Reports
          </Link>
          <Link
            href="/blog"
            onClick={closeOnNav}
            className="block px-4 py-3 text-sm tracking-wider uppercase transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            Blog
          </Link>
          <a
            href="#contact"
            onClick={closeOnNav}
            className="block px-4 py-3 text-sm tracking-wider uppercase transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            Contact
          </a>
        </div>
      )}
    </nav>
  );
}
