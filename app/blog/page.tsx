import type { Metadata, Route } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog · QG Intelligence",
  description:
    "Development notes on building QGI — scoring releases, backtest results, methodology shifts, and what the numbers actually mean.",
  alternates: { canonical: "https://qgintelligence.com/blog" },
  openGraph: {
    title: "Blog · QG Intelligence",
    description:
      "Development notes on building QGI — scoring releases, backtest results, methodology shifts, and what the numbers actually mean.",
    url: "https://qgintelligence.com/blog",
    siteName: "QG Intelligence",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Blog · QG Intelligence",
    description: "Development notes on building QGI.",
  },
};

// Hand-curated post index. New posts get appended here + their own route
// under app/blog/<slug>/page.tsx. Intentionally no CMS / MDX pipeline yet
// — shipping something honest beats architecting something grand.
// Ghana piece moved to /reports/ghana-mauritania-mirror (2026-05-19).
// Original /blog/ghana-mauritania-mirror 301-redirects via next.config.ts.
const POSTS: Array<{
  slug: string;
  title: string;
  date: string;
  dek: string;
  tags: string[];
}> = [
  {
    slug: "burkina-faso-mali-car-precedent",
    title: "Burkina Faso's risk signature mirrors Mali 2010-2012 and CAR 2011-2013",
    date: "2026-05-16",
    dek: "Five risk domains light up together on Burkina Faso in our current bake. The same combination preceded the 2012 Mali coup and the 2013 Central African Republic collapse. What that structural resemblance means — and what it doesn't.",
    tags: ["field-note", "precedent", "Sahel"],
  },
  {
    slug: "recipe-rebuild-level-4",
    title: "What we mean when we say 'Recipe'",
    date: "2026-04-26",
    dek: "The word 'Recipe' on our methodology page has been doing more rhetorical work than the code. Here is the gap, why it opened, and what the V2.0 rebuild changes.",
    tags: ["methodology", "V2.0"],
  },
  {
    slug: "curation-in-practice",
    title: "Curation in practice: Iran, Ukraine, Venezuela",
    date: "2026-04-24",
    dek: "Three countries, three different gaps in our existing event coverage, three parallel curation passes in one afternoon. What we changed, what we didn't, and why this work sits upstream of every score we publish.",
    tags: ["methodology", "curation"],
  },
  {
    slug: "cross-country-normalization",
    title: "Cross-country normalization meets the data",
    date: "2026-04-22",
    dek: "We proposed replacing per-country z-score normalization with a cross-country global approach. An Athena-backed simulation surfaced three problems before we shipped. Here's the finding, and why we're shelving V1.9.2 until event-curation coverage grows.",
    tags: ["methodology", "simulation", "V1.9.2"],
  },
  {
    slug: "margin-over-persistence-trajectory",
    title: "The margin keeps widening",
    date: "2026-04-22",
    dek: "V1.8 → V1.8.1 → V1.9 — the gap between QGI and the naïve baseline has grown at every release. Here's why, and what the number does and doesn't prove.",
    tags: ["methodology", "backtest", "V1.9"],
  },
];

export default function BlogIndexPage() {
  return (
    <div
      className="min-h-full"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "rgba(15, 25, 35, 0.85)",
        }}
      >
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-baseline gap-1" title="Home">
            <span
              className="font-data text-sm tracking-[0.25em] font-semibold"
              style={{ color: "var(--qgi-accent)", marginRight: "-0.25em" }}
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
          <Link
            href="/countries"
            className="text-xs tracking-wider uppercase px-4 py-2 rounded transition-colors"
            style={{
              backgroundColor: "var(--qgi-accent)",
              color: "var(--qgi-bg)",
            }}
          >
            Explore Countries
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-12">
          <div
            className="text-[10px] tracking-widest uppercase mb-3"
            style={{ color: "var(--qgi-accent)" }}
          >
            Blog
          </div>
          <h1 className="text-3xl font-semibold mb-4">Development notes</h1>
          <p
            className="text-lg leading-relaxed"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            Honest writeups of what we shipped, what we measured, and what the numbers
            actually mean. Not a product blog. Not marketing copy. Closer to a lab
            notebook that happens to be public.
          </p>
        </div>

        <ul className="space-y-8">
          {POSTS.map((p) => (
            <li
              key={p.slug}
              className="border-b pb-8"
              style={{ borderColor: "var(--qgi-border)" }}
            >
              <Link href={`/blog/${p.slug}` as Route} className="group block">
                <div
                  className="text-[10px] tracking-wider uppercase mb-2"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  <time dateTime={p.date}>{p.date}</time>
                  {" · "}
                  {p.tags.join(" · ")}
                </div>
                <h2
                  className="text-2xl font-semibold mb-3 transition-colors"
                  style={{ color: "var(--qgi-text)" }}
                >
                  <span className="group-hover:underline">{p.title}</span>
                </h2>
                <p
                  className="text-base leading-relaxed"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {p.dek}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <footer
          className="mt-16 pt-8 border-t text-sm"
          style={{
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text-dim)",
          }}
        >
          Want the full technical trail? See{" "}
          <Link
            href="/methodology"
            className="underline"
            style={{ color: "var(--qgi-accent)" }}
          >
            our methodology page
          </Link>
          .
        </footer>
      </article>
    </div>
  );
}
