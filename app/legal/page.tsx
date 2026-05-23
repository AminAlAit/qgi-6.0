import type { Metadata } from "next";
import Link from "next/link";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";

export const metadata: Metadata = {
  title: "Legal · QG Intelligence",
  description: "Privacy Policy, Terms of Service, and disclaimers for QGI.",
  alternates: {
    canonical: "https://qgintelligence.com/legal",
  },
  openGraph: {
    title: "Legal · QG Intelligence",
    description: "Privacy Policy, Terms of Service, and disclaimers for QGI.",
    url: "https://qgintelligence.com/legal",
    siteName: "QG Intelligence",
    type: "website",
  },
};

export default function LegalPage() {
  return (
    <div
      className="min-h-full"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      {/* Navbar */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "rgba(15, 25, 35, 0.85)",
        }}
      >
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
          {/* GH#251 + GH#245: clickable QG wordmark, links home */}
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
          <PublicNav />
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-semibold mb-12">Legal</h1>

        {/* ─── Disclaimer ──────────────────────────────────────── */}
        <Section title="Risk Disclaimer">
          <p>
            QGI provides quantitative analytical tools for informational purposes only.
            QGI scores, risk tiers, precedent analyses, and country profiles are{" "}
            <strong>
              not investment advice, financial advice, or political forecasts
            </strong>
            .
          </p>
          <p>
            Risk tiers (HIGH, MODERATE, INDICATIVE) reflect historical precedent density
            in economic indicator data. They do not represent probabilities of future
            events. Users should not make financial, political, or security decisions
            based solely on QGI output.
          </p>
          <p>
            QGI surfaces risk candidates that analysts should examine. It does not replace
            expert judgment, on-the-ground intelligence, or professional advisory
            services.
          </p>
        </Section>

        {/* ─── Terms of Service ────────────────────────────────── */}
        <Section title="Terms of Service">
          <p>
            By accessing qgintelligence.com (&ldquo;the Service&rdquo;), you agree to the
            following terms. If you do not agree, do not use the Service.
          </p>

          <H3>Use of the Service</H3>
          <p>
            The Service is provided &ldquo;as is&rdquo; without warranty of any kind,
            express or implied. QGI does not guarantee the accuracy, completeness, or
            timeliness of any data, scores, or analyses presented.
          </p>
          <p>
            You may use QGI data for personal research, academic work, and professional
            analysis. Systematic redistribution of raw QGI data without attribution is
            prohibited. Citation format: &ldquo;Source: QGI (qgintelligence.com)&rdquo;.
          </p>

          <H3>Data Sources</H3>
          <p>
            QGI uses publicly available data from the World Bank (CC BY 4.0), and plans to
            integrate data from V-Dem Institute (CC BY 4.0), FAOSTAT (CC BY 4.0), ILOSTAT
            (CC BY 4.0), UNHCR (CC BY 4.0), UCDP (CC BY 4.0), and GDELT (CC0). All source
            data is properly attributed. QGI&apos;s derived products (SCDIs, Patterns,
            Precedents, Salience Scores) are original computations.
          </p>

          <H3>Limitation of Liability</H3>
          <p>
            QGI shall not be liable for any direct, indirect, incidental, special, or
            consequential damages arising from the use or inability to use the Service,
            including but not limited to losses resulting from reliance on QGI scores or
            analyses.
          </p>

          <H3>Changes to Terms</H3>
          <p>
            QGI may update these terms at any time. Continued use of the Service after
            changes constitutes acceptance. Material changes will be noted on this page
            with the updated date.
          </p>
        </Section>

        {/* ─── Privacy Policy ─────────────────────────────────── */}
        <Section title="Privacy Policy">
          <H3>What We Collect</H3>
          <p>
            QGI collects minimal data. When you use the Service without an account, we
            collect only anonymized usage analytics (page views, country lookups) through
            privacy-respecting analytics tools. No cookies are used for tracking.
          </p>
          <p>
            If you create an account (via Google OAuth or email), we store your email
            address and display name for authentication purposes only.
          </p>

          <H3>What We Do Not Collect</H3>
          <p>
            We do not collect personal financial data, location data, advertising
            identifiers, or any data beyond what is necessary for the Service to function.
            We do not sell, share, or rent personal data to third parties.
          </p>

          <H3>Data Storage</H3>
          <p>
            Account data is stored securely using industry-standard encryption. Analytics
            data is anonymized and aggregated. All data processing occurs in the EU
            (eu-central-1 region).
          </p>

          <H3>Your Rights (GDPR)</H3>
          <p>
            If you are in the European Economic Area, you have the right to access,
            correct, or delete your personal data. To exercise these rights, contact us at
            the email below.
          </p>

          <H3>Third-Party Services</H3>
          <p>
            The Service uses Vercel for hosting, AWS for data processing, and (optionally)
            Google OAuth for authentication. Each has its own privacy policy.
          </p>
        </Section>

        {/* ─── Data Attribution ────────────────────────────────── */}
        <Section title="Data Attribution">
          <p>
            QGI acknowledges the following data providers whose open data makes this
            platform possible:
          </p>
          <ul
            className="list-disc list-inside space-y-1 mt-3"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            <li>World Bank Open Data — CC BY 4.0</li>
            <li>V-Dem Institute, University of Gothenburg — CC BY 4.0</li>
            <li>
              Food and Agriculture Organization of the United Nations (FAOSTAT) — CC BY
              4.0
            </li>
            <li>International Labour Organization (ILOSTAT) — CC BY 4.0</li>
            <li>UNHCR — The UN Refugee Agency — CC BY 4.0</li>
            <li>Uppsala Conflict Data Program (UCDP), Uppsala University — CC BY 4.0</li>
            <li>GDELT Project — CC0 (Public Domain)</li>
          </ul>
        </Section>

        {/* ─── Contact ─────────────────────────────────────────── */}
        <Section title="Contact">
          <p>
            For questions about these terms, data use, or to exercise your data rights,
            contact:{" "}
            <a
              href="mailto:amin@qgintelligence.com"
              style={{ color: "var(--qgi-accent)" }}
              className="hover:underline"
            >
              amin@qgintelligence.com
            </a>
          </p>
        </Section>

        <p
          className="text-[10px] mt-12 text-center"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Last updated: April 24, 2026
        </p>
      </article>
      <PublicFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div
        className="space-y-3 text-sm leading-relaxed"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        {children}
      </div>
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold mt-5 mb-1" style={{ color: "var(--qgi-text)" }}>
      {children}
    </h3>
  );
}
