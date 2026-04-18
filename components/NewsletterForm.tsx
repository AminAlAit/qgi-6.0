"use client";

import { useState } from "react";

/**
 * NewsletterForm — lightweight email capture.
 * No backend: on submit shows a thank-you message.
 * Wire to a real mailing list provider (Mailchimp, Resend, etc.) when ready.
 */
export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p
        className="text-sm"
        style={{ color: "var(--qgi-success)" }}
      >
        Subscribed. We will be in touch.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        className="flex-1 px-4 py-2.5 rounded text-sm outline-none transition-colors"
        style={{
          backgroundColor: "var(--qgi-surface-2)",
          border: "1px solid var(--qgi-border)",
          color: "var(--qgi-text)",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "var(--qgi-accent)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "var(--qgi-border)";
        }}
      />
      <button
        type="submit"
        className="px-5 py-2.5 rounded text-sm font-medium tracking-wide transition-all hover:brightness-110 whitespace-nowrap"
        style={{
          backgroundColor: "var(--qgi-accent)",
          color: "var(--qgi-bg)",
        }}
      >
        Subscribe
      </button>
      {error && (
        <p
          className="text-xs mt-1 sm:mt-0 sm:self-center"
          style={{ color: "var(--qgi-danger)" }}
        >
          {error}
        </p>
      )}
    </form>
  );
}
