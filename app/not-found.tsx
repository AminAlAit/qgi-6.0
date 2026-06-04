import Link from "next/link";
import type { Route } from "next";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { SkipLink } from "@/components/SkipLink";

/**
 * Root 404 for the public surface (/, /methodology, /blog, /reports, /about,
 * /legal, /contact and any mistyped URL outside the (app) shell). The (app)
 * group has its own in-shell not-found; this one wears the public chrome so a
 * bad public URL still lands on a branded page, not Next's bare default.
 */
export default function NotFound() {
  const links: { href: Route; label: string }[] = [
    { href: "/" as Route, label: "Home" },
    { href: "/dashboard" as Route, label: "Dashboard" },
    { href: "/methodology" as Route, label: "Methodology" },
    { href: "/countries" as Route, label: "Countries" },
    { href: "/trends" as Route, label: "Trends" },
  ];
  return (
    <div
      className="min-h-full"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <SkipLink />
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "rgba(15, 25, 35, 0.85)",
        }}
      >
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <Link href={"/" as Route} className="flex items-baseline gap-1" title="Home">
            <span
              className="text-sm tracking-[0.25em] font-semibold"
              style={{
                color: "var(--qgi-accent)",
                marginRight: "-0.25em",
                fontFamily:
                  "'Century Gothic', 'CenturyGothic', 'URW Gothic', 'AppleGothic', 'ITC Avant Garde Gothic', var(--font-qg-brand), sans-serif",
              }}
            >
              QG
            </span>
            <span
              className="text-[11px] tracking-widest uppercase"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Intelligence
            </span>
          </Link>
          <PublicNav />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <section className="mx-auto max-w-2xl px-6 py-28 text-center">
          <p
            className="text-[10px] tracking-widest uppercase mb-3"
            style={{
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            404 · Not found
          </p>
          <h1
            className="text-3xl font-semibold mb-4"
            style={{ color: "var(--qgi-text)" }}
          >
            This page doesn&rsquo;t exist.
          </h1>
          <p
            className="text-base leading-relaxed mb-8 max-w-md mx-auto"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            The URL you tried isn&rsquo;t one of QGI&rsquo;s pages. If you followed a
            bookmark, it may have moved. Here is the way back.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="px-4 py-2 rounded text-[11px] tracking-widest uppercase border transition-colors hover:bg-[var(--qgi-surface-2)]"
                style={{
                  borderColor: "var(--qgi-border)",
                  color: "var(--qgi-text-muted)",
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
