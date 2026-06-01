import { NextResponse } from "next/server";
import { z } from "zod";
import { addNewsletterContact, deliverEmail } from "@/lib/email-delivery";

/**
 * POST /api/newsletter
 *
 * Captures a newsletter sign-up (email only) and notifies the ops inbox via
 * Resend. No database: the signal is an email to the team, which is enough
 * for the pre-launch list. When a managed list (e.g. a Resend Audience or an
 * ESP) is wired, swap the deliver call for an audience-add.
 *
 * Returns 200 {ok:true} on delivery, 422 on a bad email, 503 when delivery
 * is not configured or fails — the client surfaces a graceful retry, never a
 * fake success.
 */
const Body = z.object({
  email: z.string().trim().email().max(254),
  // Honeypot — must stay empty. Bots fill every field.
  company: z.string().max(0).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 422 }
    );
  }

  // Honeypot tripped: pretend success, save nothing.
  if (parsed.data.company) return NextResponse.json({ ok: true });

  // Preferred: persist the address as a contact in the Resend audience.
  const saved = await addNewsletterContact(parsed.data.email);
  if (saved.ok) return NextResponse.json({ ok: true });

  // Fallback: if the audience is not configured, at least notify the ops inbox
  // so a sign-up is never silently dropped.
  if (!saved.configured) {
    const notified = await deliverEmail({
      subject: "New QGI newsletter sign-up",
      text: `New newsletter sign-up (audience not configured):\n\n${parsed.data.email}\n`,
    });
    if (notified.ok) return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: "Could not record your sign-up just now. Please try again shortly." },
    { status: 503 }
  );
}
