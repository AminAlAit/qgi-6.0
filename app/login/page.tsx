import Link from "next/link";

/**
 * Login page — Google OAuth + Email magic link.
 * Placeholder until Amin creates the Google OAuth app.
 */
export default function LoginPage() {
  return (
    <div
      className="min-h-full flex items-center justify-center"
      style={{ backgroundColor: "var(--qgi-bg)" }}
    >
      <div
        className="w-full max-w-sm rounded-lg border p-8"
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

        {/* Google sign-in */}
        <form action="/api/auth/signin/google" method="POST">
          <button
            type="submit"
            className="w-full py-2.5 rounded text-sm font-medium tracking-wide border transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text)",
            }}
          >
            Continue with Google
          </button>
        </form>

        <div
          className="text-center text-[10px] tracking-wider my-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          OR
        </div>

        {/* Email magic link (placeholder) */}
        <form>
          <input
            type="email"
            placeholder="Enter your email"
            className="w-full px-4 py-2.5 rounded border text-sm mb-3 outline-none transition-colors focus:border-[var(--qgi-accent)]"
            style={{
              backgroundColor: "var(--qgi-bg)",
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text)",
            }}
          />
          <button
            type="submit"
            className="w-full py-2.5 rounded text-sm font-medium tracking-wide transition-colors hover:brightness-110"
            style={{
              backgroundColor: "var(--qgi-accent)",
              color: "var(--qgi-bg)",
            }}
          >
            Send Magic Link
          </button>
        </form>

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
