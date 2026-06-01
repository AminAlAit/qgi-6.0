import Link from "next/link";
import type { Metadata } from "next";

/**
 * Login page — #429 (2026-04-24): both auth paths are currently broken
 * in prod (Google OAuth returns 500 because GOOGLE_CLIENT_ID is unset on
 * Vercel; email magic-link form has no handler). Rather than ship two
 * dead buttons that users can click and get 500s / silent reloads, the
 * page renders a "Sign-in coming soon" banner while SKIP_AUTH=true is
 * still the production posture.
 *
 * When auth goes live (#448 M3 work), restore the Google form +
 * wire the email magic-link to signIn("email", ...).
 *
 * Route is kept alive so existing links + middleware redirects resolve.
 * noindex on metadata so Google doesn't surface a coming-soon page.
 */
export const metadata: Metadata = {
  title: "Sign in · QG Intelligence",
  description: "Sign-in coming soon. Contact amin@qgintelligence.com for early access.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div
      className="min-h-full flex items-center justify-center p-6"
      style={{ backgroundColor: "var(--qgi-bg)" }}
    >
      <div
        className="w-full max-w-md rounded-lg border p-8"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <span
            className="font-data text-lg tracking-[0.25em] font-semibold"
            style={{ color: "var(--qgi-accent)" }}
          >
            QGI
          </span>
          <p
            className="mt-2 text-xs tracking-wider uppercase"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            Quantitative Geopolitical Intelligence
          </p>
        </div>

        {/* Coming-soon banner */}
        <div
          className="rounded border p-5 mb-6"
          style={{
            borderColor: "var(--qgi-accent)",
            backgroundColor: "var(--qgi-accent-glow, rgba(56, 189, 248, 0.08))",
          }}
        >
          <div
            className="text-[10px] tracking-widest uppercase mb-2"
            style={{ color: "var(--qgi-accent)" }}
          >
            Sign-in coming soon
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text)" }}>
            Account creation is not yet open. The dashboard and all country intelligence
            pages are publicly browsable today, no login needed.
          </p>
        </div>

        {/* What you can do now */}
        <div className="space-y-3 mb-6">
          <Link
            href="/countries"
            className="block w-full text-center py-2.5 rounded text-sm font-medium tracking-wide transition-all hover:brightness-110"
            style={{
              backgroundColor: "var(--qgi-accent)",
              color: "var(--qgi-bg)",
            }}
          >
            Explore Countries
          </Link>
          <Link
            href="/dashboard"
            className="block w-full text-center py-2.5 rounded text-sm tracking-wide border transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text)",
            }}
          >
            Open Dashboard
          </Link>
        </div>

        {/* Early access contact */}
        <p
          className="text-center text-xs leading-relaxed"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Interested in early access for your team? Email{" "}
          <a
            href="mailto:amin@qgintelligence.com?subject=QGI%20Early%20Access"
            className="underline hover:text-[var(--qgi-accent)]"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            amin@qgintelligence.com
          </a>
        </p>

        {/* Back to landing */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs transition-colors hover:text-[var(--qgi-accent)]"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            &larr; Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
