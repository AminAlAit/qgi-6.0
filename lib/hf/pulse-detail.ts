/**
 * hf/pulse-detail — server-side slicer for the news layer's deep data.
 *
 * data/hf-pulse-detail.json carries the FULL monthly pulse history
 * (2015->present) for every covered country x topic, plus the verified
 * event markers (elections from public calendars, conflict from UCDP,
 * economic from World Bank/IMF series). ~380KB: this module is imported
 * ONLY by server components (country page, live-pulse page), which slice
 * out one country's series before anything crosses to the client.
 */

import detail from "@/data/hf-pulse-detail.json";
import { getHfBoard, type HfCell, type HfTopic } from "@/lib/hf/topics-data";

export interface HfEventMarker {
  date: string; // YYYY-MM
  label: string;
}

export interface HfTopicSeries {
  topic: HfTopic;
  cell: HfCell | null;
  months: string[];
  pulse: number[];
  events: HfEventMarker[];
}

export interface HfCountryDetail {
  name: string;
  iso3: string;
  built: string;
  vintage: string;
  thresholds: { struct: number; pulse: number };
  verdicts: ReturnType<typeof getHfBoard>["verdicts"];
  /** Board topics first (founder-ratified six), then the rest. */
  series: HfTopicSeries[];
}

const raw = detail as unknown as {
  built: string;
  history: Record<string, { months: string[]; pulse: number[] }>;
  events: Record<string, Array<{ date: string; label: string }>>;
};

/** Full news-layer detail for one country, or null when not covered. */
export function getHfCountryDetail(iso3Upper: string): HfCountryDetail | null {
  const board = getHfBoard();
  const country = board.countries.find((c) => c.iso3 === iso3Upper.toUpperCase());
  if (!country) return null;

  const ordered = [
    ...board.topics.filter((t) => t.board),
    ...board.topics.filter((t) => !t.board),
  ];
  const series: HfTopicSeries[] = [];
  for (const topic of ordered) {
    const key = `${country.iso3}|${topic.id}`;
    const h = raw.history[key];
    if (!h) continue;
    series.push({
      topic,
      cell: board.cells[key] ?? null,
      months: h.months,
      pulse: h.pulse,
      // Belt against a bad bake: never let an unresolved Wikidata id render
      // as an event label (the generator already drops them).
      events: (raw.events[key] ?? []).filter((e) => !/^Q\d+$/.test(e.label)),
    });
  }
  if (series.length === 0) return null;

  // The heatmaps index every series positionally against series[0]'s month
  // axis. All bakes to date are aligned (one shared 2015->present axis); a
  // ragged future bake should degrade visibly, not silently shift cells.
  const axis = series[0];
  const aligned = series.filter(
    (s) =>
      s.months.length === axis.months.length &&
      s.months[0] === axis.months[0] &&
      s.months[s.months.length - 1] === axis.months[axis.months.length - 1]
  );
  if (aligned.length !== series.length) {
    console.warn(
      `hf/pulse-detail: dropped ${series.length - aligned.length} misaligned series for ${country.iso3}`
    );
  }

  return {
    name: country.name,
    iso3: country.iso3,
    built: raw.built,
    vintage: board.vintage,
    thresholds: board.thresholds,
    verdicts: board.verdicts,
    series: aligned,
  };
}

/** ISO3 (lowercase) list of covered countries — for generateStaticParams. */
export function hfCoveredIso3(): string[] {
  return getHfBoard().countries.map((c) => c.iso3.toLowerCase());
}

/**
 * Trimmed slice for the standard country page: board topics only, last 36
 * months. The full-depth series stay on /countries/[iso]/live-pulse.
 */
export function getHfCountryPanelData(iso3Upper: string): HfCountryDetail | null {
  const d = getHfCountryDetail(iso3Upper);
  if (!d) return null;
  const series = d.series
    .filter((s) => s.topic.board)
    .map((s) => {
      const months = s.months.slice(-36);
      const from = months[0] ?? "";
      return {
        ...s,
        months,
        pulse: s.pulse.slice(-36),
        events: s.events.filter((e) => e.date >= from),
      };
    });
  // No board coverage -> no panels (never render empty frames).
  if (series.length === 0) return null;
  return { ...d, series };
}
