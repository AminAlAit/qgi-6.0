/**
 * email-delivery — thin wrapper over the Resend REST API used by the public
 * /api/newsletter and /api/contact route handlers.
 *
 * No SDK dependency: we POST to https://api.resend.com/emails with `fetch`,
 * so the bundle stays lean and there is nothing to keep in lockstep with a
 * package version.
 *
 * Configuration (all via env — set in Vercel project settings):
 *   RESEND_API_KEY   required to actually deliver. Absent ⇒ deliver() returns
 *                    { ok:false, configured:false } and the caller surfaces a
 *                    graceful failure (we never fake a success).
 *   EMAIL_FROM       sender, must be a Resend-verified domain address.
 *                    Default "QG Intelligence <noreply@qgintelligence.com>".
 *   EMAIL_TO         destination inbox. Default the ops inbox
 *                    "contact@qgintelligence.com".
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface DeliverInput {
  subject: string;
  text: string;
  /** Optional reply-to (e.g. the sender's address on a contact form). */
  replyTo?: string;
}

export interface DeliverResult {
  ok: boolean;
  /** false when RESEND_API_KEY is not set — lets the caller return a clear 503. */
  configured: boolean;
}

/**
 * Persist a newsletter sign-up as a contact in a Resend Audience. This is the
 * real "save the email" path: contacts live in the audience, exportable and
 * mailable later. Requires RESEND_API_KEY + RESEND_AUDIENCE_ID. Returns
 * { ok:false, configured:false } when the audience is not set up, so the caller
 * can fall back to a notification email rather than silently dropping the address.
 */
export async function addNewsletterContact(email: string): Promise<DeliverResult> {
  const key = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!key || !audienceId) return { ok: false, configured: false };

  try {
    const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    });
    // 200/201 = created; 409 = already a contact, which we treat as success.
    if (res.ok || res.status === 409) return { ok: true, configured: true };
    const body = await res.text().catch(() => "");
    console.error("[email-delivery] Resend audience add failed", res.status, body.slice(0, 300));
    return { ok: false, configured: true };
  } catch (err) {
    console.error("[email-delivery] audience request failed:", err);
    return { ok: false, configured: true };
  }
}

export async function deliverEmail({ subject, text, replyTo }: DeliverInput): Promise<DeliverResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, configured: false };

  const from = process.env.EMAIL_FROM || "QG Intelligence <noreply@qgintelligence.com>";
  const to = process.env.EMAIL_TO || "contact@qgintelligence.com";

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      // Don't surface the provider body to the client; log server-side only.
      const body = await res.text().catch(() => "");
      console.error("[email-delivery] Resend responded", res.status, body.slice(0, 300));
      return { ok: false, configured: true };
    }
    return { ok: true, configured: true };
  } catch (err) {
    console.error("[email-delivery] request failed:", err);
    return { ok: false, configured: true };
  }
}
