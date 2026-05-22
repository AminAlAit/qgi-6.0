/**
 * NewsletterForm — email capture placeholder.
 *
 * HISTORY
 * - Original: client-side fake form that threw submissions away (no backend).
 * - 2026-04-19 (#353): form disabled until real backend ships. Replaced with
 *   a mailto CTA to amin@qgintelligence.com so interest is captured in Amin's
 *   inbox rather than silently dropped. When #353 is implemented, restore a
 *   real form that POSTs to /api/newsletter/subscribe.
 */
export default function NewsletterForm() {
  return (
    <div className="w-full max-w-md">
      <a
        href="mailto:amin@qgintelligence.com?subject=QGI%20Newsletter%20Signup"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium tracking-wide transition-all hover:brightness-110"
        style={{
          backgroundColor: "var(--qgi-accent)",
          color: "var(--qgi-bg)",
        }}
      >
        Email amin@qgintelligence.com
      </a>
      <p className="text-xs mt-3" style={{ color: "var(--qgi-text-dim)" }}>
        Newsletter launching soon — email to get on the list.
      </p>
    </div>
  );
}
