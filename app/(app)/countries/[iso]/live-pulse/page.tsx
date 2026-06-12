/**
 * /countries/[iso]/live-pulse — the per-country pro terminal behind the ⚡
 * entry on the country page (founder-ratified sub-route, 2026-06-10).
 *
 * Density-first counterpart to the standard country page: the reader has
 * already seen the explanatory arc there, so this view goes straight to
 * instruments (decade-deep pulse stage, all-themes quadrant, drift matrix).
 * The cyan header underline is the single "pro mode" cue (V4.1: one cue,
 * no theatrics). Only exists for covered countries; everything is real
 * data, sliced server-side to this one country.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { getCountryByIso } from "@/lib/te-mock/countries-v4-data";
import { CountryV41Header } from "@/components/countries-v4-1/CountryV41Header";
import { LivePulseClient } from "@/components/countries-v4-1/LivePulseClient";
import { HowToReadButton } from "@/components/te-v4-shared/HowToReadButton";
import { getHfCountryDetail, hfCoveredIso3 } from "@/lib/hf/pulse-detail";
import { getLiveStamp } from "@/lib/hf/live-pulse";
import { LivePulseStamp } from "@/components/hf/LivePulseStamp";

interface Params {
  params: Promise<{ iso: string }>;
}

// ISR (live-pulse track): the prerendered per-country pages re-read the live
// pulse file at runtime every 5 minutes (with the Vercel OIDC token) so the
// freshness stamp reflects the hourly poller instead of build time.
export const revalidate = 300;

export async function generateStaticParams() {
  // Covered by the news layer AND present in the curated country set.
  return hfCoveredIso3()
    .filter((iso) => Boolean(getCountryByIso(iso)))
    .map((iso) => ({ iso }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { iso } = await params;
  const country = getCountryByIso(iso);
  // Coverage gates the title too — a shared link to an uncovered country
  // must not advertise a surface that 404s (review finding).
  const covered = country ? Boolean(getHfCountryDetail(country.iso)) : false;
  return {
    title:
      country && covered
        ? `${country.name} · Live Pulse · QG Intelligence`
        : "Country not found · QG Intelligence",
    description:
      country && covered
        ? `${country.name} on the Live Pulse terminal: a decade of monthly news pulse across fourteen themes, set against structural readings and the verified event record.`
        : "Country not found.",
  };
}

export default async function LivePulsePage({ params }: Params) {
  const { iso } = await params;
  const country = getCountryByIso(iso);
  const detail = country ? getHfCountryDetail(country.iso) : null;
  if (!country || !detail) notFound();

  // News-pulse freshness gate (live-pulse track). Renders nothing until the
  // hourly poller is live; the terminal stays exactly as it is today.
  const liveStamp = await getLiveStamp();

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      {/* Header band — the 2px cyan underline is the one pro-mode cue. */}
      <div
        style={{
          borderBottom: "2px solid var(--qgi-accent)",
          background: "var(--qgi-surface)",
        }}
      >
        <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "20px 24px 24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <nav
              aria-label="Breadcrumb"
              style={{
                fontSize: "11px",
                letterSpacing: "0.3px",
                color: "var(--qgi-text-dim)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              <Link
                href={`/countries/${iso}` as Route}
                style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
              >
                ← {country.name}
              </Link>
              <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
              <span style={{ color: "var(--qgi-accent)" }}>Live Pulse</span>
            </nav>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  fontSize: "10px",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  color: "var(--qgi-accent)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                ⚡ Live Pulse
              </span>
              {/* News-pulse freshness — only shows once the hourly poller is
                  live; otherwise invisible (terminal shows monthly readings). */}
              <LivePulseStamp
                status={liveStamp.status}
                ageMinutes={liveStamp.ageMinutes}
                compact
              />
              {/* Soft landing (founder 2026-06-11): the terminal stays dense,
                  but first-timers get the same how-to-read affordance the
                  structural pages carry. */}
              <HowToReadButton routeKey="live-pulse" />
            </div>
          </div>
          <CountryV41Header country={country} />
          {/* One orientation sentence for direct arrivals. */}
          <p
            style={{
              color: "var(--qgi-text-muted)",
              fontSize: "13.5px",
              lineHeight: 1.6,
              maxWidth: "860px",
              margin: "12px 0 0",
            }}
          >
            Live Pulse reads {country.name} through fourteen news themes. Pick a theme and
            the chart shows a decade of its news pulse, how much of the country&apos;s
            news coverage runs on that theme each month, against the structural reading
            and the events on the verified record.
          </p>
        </div>
      </div>

      {/* Terminal body — keyed by country so client selection state resets
          on cross-country navigation instead of leaking (review finding). */}
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "20px 24px 64px" }}>
        <LivePulseClient key={detail.iso3} detail={detail} />
      </div>
    </div>
  );
}
