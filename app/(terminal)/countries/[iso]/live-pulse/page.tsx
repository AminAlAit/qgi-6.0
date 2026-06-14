/**
 * /countries/[iso]/live-pulse — the per-country PRO TERMINAL.
 *
 * Full-screen takeover (founder 2026-06-13): a QGI × TradingView terminal that
 * matches the `qgi-console/pulse.html` (:8761) prototype — left rail to switch
 * country/topic, a center pulse stage, and a permanent LIVE NEWS column on the
 * right. Lives in the (terminal) route group so it escapes the app sidebar and
 * owns the whole viewport.
 *
 * Coverage is the NEWS layer (every country in the Topics board), NOT the
 * separate structural country-page set. Two news countries (Bangladesh,
 * Thailand) have full news + resemblance data but no curated country page;
 * they must still get a terminal, so this route never gates on that set —
 * the country name + flag come from the news data itself.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Route } from "next";
import { getCountryByIso } from "@/lib/te-mock/countries-v4-data";
import { getHfCountryDetail, hfCoveredIso3 } from "@/lib/hf/pulse-detail";
import { getHfBoard } from "@/lib/hf/topics-data";
import { getLivePulseSeries } from "@/lib/hf/live-pulse-series";
import { LivePulseTerminal } from "@/components/countries-v4-1/LivePulseTerminal";

interface Params {
  params: Promise<{ iso: string }>;
}

export async function generateStaticParams() {
  // Every country the news layer covers — the structural country-page set is
  // a separate, broader roster and must not gate news coverage.
  return hfCoveredIso3().map((iso) => ({ iso }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { iso } = await params;
  const detail = getHfCountryDetail(iso);
  const title = detail
    ? `${detail.name} · Live Pulse · QG Intelligence`
    : "Country not found · QG Intelligence";
  const description = detail
    ? `${detail.name} on the Live Pulse pro terminal: eleven years of monthly news pulse across fourteen themes, the live GDELT feed, set against structural readings and the verified event record.`
    : "Country not found.";
  return {
    title,
    description,
    ...(detail
      ? {
          openGraph: { title, description, type: "website" as const },
          alternates: {
            canonical: `/countries/${iso.toLowerCase()}/live-pulse`,
          },
        }
      : {}),
  };
}

export default async function LivePulsePage({ params }: Params) {
  const { iso } = await params;
  const detail = getHfCountryDetail(iso);
  if (!detail) notFound();

  // Multi-resolution series + article feed (Track 2). Null until the data
  // exists for this country; the terminal falls back to the monthly view.
  const seriesData = await getLivePulseSeries(detail.iso3);

  // Rail country list — every news-covered country. Flag is resolved from the
  // name inside the terminal (FlagImg), so this stays independent of the
  // country-page set.
  const board = getHfBoard();
  const countries = board.countries.map((c) => ({
    name: c.name,
    iso3: c.iso3,
    param: c.iso3.toLowerCase(),
  }));

  // Back to the structural country profile when one exists; otherwise to the
  // news board (BGD/THA have no profile page yet).
  const hasProfile = Boolean(getCountryByIso(iso));
  const backHref: Route = hasProfile
    ? (`/countries/${iso}` as Route)
    : ("/risk-board" as Route);
  const backLabel = hasProfile ? "COUNTRY PROFILE" : "NEWS BOARD";

  return (
    <LivePulseTerminal
      detail={detail}
      seriesData={seriesData}
      countries={countries}
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
