"use client";

/**
 * WorldMapChart -- ECharts choropleth world map colored by risk tier.
 *
 * Fetches a lightweight TopoJSON at runtime from jsDelivr (world-atlas),
 * converts to GeoJSON, registers it with ECharts, and renders each country
 * colored by its QGI risk tier.
 *
 * Click navigates to /countries/{id}. Hover shows tooltip with name + tier.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as echarts from "echarts/core";
import { MapChart } from "echarts/charts";
import { TooltipComponent, VisualMapComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { RiskTier } from "@/lib/country-risks";

// Register ECharts modules (idempotent)
echarts.use([MapChart, TooltipComponent, VisualMapComponent, CanvasRenderer]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MapCountry {
  id: string;
  name: string;
  alpha_2: string;
  tier: RiskTier;
  region: string;
}

interface Props {
  countries: MapCountry[];
}

/** Minimal GeoJSON types (avoids @types/geojson dependency). */
interface GeoFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: unknown;
  };
  id?: string | number;
}

interface GeoFeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

/** Intermediate type for series data items. */
interface SeriesItem {
  name: string;
  value: number;
  tier: RiskTier | null;
  qgiId: string | null;
  qgiName: string;
  alpha2: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<RiskTier, string> = {
  HIGH: "#f87171",
  MODERATE: "#fbbf24",
  INDICATIVE: "#38bdf8",
};

const TIER_VALUES: Record<RiskTier, number> = {
  HIGH: 3,
  MODERATE: 2,
  INDICATIVE: 1,
};

const NO_DATA_COLOR = "#1a2a3a";

const GEOJSON_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ---------------------------------------------------------------------------
// QGI name -> GeoJSON name mapping
// ---------------------------------------------------------------------------

/**
 * Maps QGI country names (from country-risks.json) to the names used in
 * the Natural Earth / world-atlas TopoJSON features.
 * Only entries that actually differ need to be listed here.
 */
const QGI_TO_GEO: Record<string, string> = {
  "United States": "United States of America",
  "Ivory Coast": "Cote d'Ivoire",
  "Turkiye": "Turkey",
  "Czechia": "Czech Republic",
  "North Macedonia": "Macedonia",
  "Bosnia and Herzegovina": "Bosnia and Herz.",
  "Central African Republic": "Central African Rep.",
  "Dominican Republic": "Dominican Rep.",
};

/**
 * Reverse map: GeoJSON name -> QGI name, for looking up data by geo feature.
 */
const GEO_TO_QGI: Record<string, string> = {};
for (const [qgi, geo] of Object.entries(QGI_TO_GEO)) {
  GEO_TO_QGI[geo] = qgi;
}

// ---------------------------------------------------------------------------
// TopoJSON -> GeoJSON converter (minimal, for world-atlas format)
// ---------------------------------------------------------------------------

interface TopoGeometry {
  type: string;
  arcs: number[][][] | number[][];
  properties?: Record<string, unknown>;
  id?: string;
}

interface TopoObject {
  type: string;
  geometries: TopoGeometry[];
}

interface Topology {
  type: string;
  objects: Record<string, TopoObject>;
  arcs: number[][][];
  transform?: {
    scale: [number, number];
    translate: [number, number];
  };
}

function topoToGeo(topology: Topology): GeoFeatureCollection {
  const objKey =
    "countries" in topology.objects
      ? "countries"
      : Object.keys(topology.objects)[0];
  const obj = topology.objects[objKey];

  const { arcs: rawArcs, transform } = topology;
  const decodedArcs: number[][][] = rawArcs.map((arc) => {
    const decoded: number[][] = [];
    let x = 0;
    let y = 0;
    for (const point of arc) {
      x += point[0];
      y += point[1];
      if (transform) {
        decoded.push([
          x * transform.scale[0] + transform.translate[0],
          y * transform.scale[1] + transform.translate[1],
        ]);
      } else {
        decoded.push([x, y]);
      }
    }
    return decoded;
  });

  function decodeArc(index: number): number[][] {
    if (index >= 0) return decodedArcs[index];
    return [...decodedArcs[~index]].reverse();
  }

  function decodeRing(indices: number[]): number[][] {
    const coords: number[][] = [];
    for (const idx of indices) {
      const arcCoords = decodeArc(idx);
      const start = coords.length > 0 ? 1 : 0;
      for (let i = start; i < arcCoords.length; i++) {
        coords.push(arcCoords[i]);
      }
    }
    return coords;
  }

  const features: GeoFeature[] = obj.geometries.map((geom) => {
    let geometry: { type: string; coordinates: unknown };

    if (geom.type === "Polygon") {
      const rings = (geom.arcs as number[][]).map((ring) => decodeRing(ring));
      geometry = { type: "Polygon", coordinates: rings };
    } else if (geom.type === "MultiPolygon") {
      const polys = (geom.arcs as number[][][]).map((polygon) =>
        polygon.map((ring) => decodeRing(ring))
      );
      geometry = { type: "MultiPolygon", coordinates: polys };
    } else {
      geometry = { type: "Point", coordinates: [0, 0] };
    }

    return {
      type: "Feature" as const,
      properties: {
        name: geom.properties?.name ?? "",
        ...geom.properties,
      },
      geometry,
      id: geom.id,
    };
  });

  // Fix antimeridian rendering bug: clamp all longitude values to [-180, 180].
  // TopoJSON delta-encoding can produce longitudes slightly > 180 for features
  // that cross the antimeridian (Russia, Fiji, etc.), causing the renderer to
  // draw lines across the entire map.
  for (const feature of features) {
    clampCoordinates(feature.geometry);
  }

  return { type: "FeatureCollection" as const, features };
}

/**
 * Recursively walk all coordinate arrays in a GeoJSON geometry and
 * wrap any longitude > 180 to longitude - 360 (and < -180 to + 360).
 */
function clampCoordinates(geometry: { type: string; coordinates: unknown }) {
  function walkCoords(coords: unknown): void {
    if (!Array.isArray(coords)) return;
    // If this is a coordinate pair [lng, lat, ...]
    if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
      // Wrap longitude to [-180, 180]
      if (coords[0] > 180) coords[0] = coords[0] - 360;
      else if (coords[0] < -180) coords[0] = coords[0] + 360;
      return;
    }
    // Otherwise recurse into nested arrays (rings, polygons, multi-polygons)
    for (const child of coords) {
      walkCoords(child);
    }
  }
  walkCoords(geometry.coordinates);
}

// ---------------------------------------------------------------------------
// Country name index from world-atlas numeric IDs
// world-atlas uses ISO 3166-1 numeric codes as feature IDs.
// ---------------------------------------------------------------------------

const ISO_NUMERIC_TO_NAME: Record<string, string> = {
  "4": "Afghanistan",
  "8": "Albania",
  "12": "Algeria",
  "24": "Angola",
  "32": "Argentina",
  "36": "Australia",
  "40": "Austria",
  "31": "Azerbaijan",
  "48": "Bahrain",
  "50": "Bangladesh",
  "112": "Belarus",
  "56": "Belgium",
  "68": "Bolivia",
  "70": "Bosnia and Herz.",
  "76": "Brazil",
  "96": "Brunei",
  "100": "Bulgaria",
  "854": "Burkina Faso",
  "108": "Burundi",
  "116": "Cambodia",
  "120": "Cameroon",
  "124": "Canada",
  "140": "Central African Rep.",
  "148": "Chad",
  "152": "Chile",
  "156": "China",
  "170": "Colombia",
  "178": "Congo",
  "180": "Dem. Rep. Congo",
  "188": "Costa Rica",
  "384": "Cote d'Ivoire",
  "191": "Croatia",
  "192": "Cuba",
  "196": "Cyprus",
  "203": "Czech Republic",
  "208": "Denmark",
  "262": "Djibouti",
  "214": "Dominican Rep.",
  "218": "Ecuador",
  "818": "Egypt",
  "222": "El Salvador",
  "226": "Eq. Guinea",
  "232": "Eritrea",
  "233": "Estonia",
  "231": "Ethiopia",
  "246": "Finland",
  "250": "France",
  "266": "Gabon",
  "270": "Gambia",
  "268": "Georgia",
  "276": "Germany",
  "288": "Ghana",
  "300": "Greece",
  "320": "Guatemala",
  "324": "Guinea",
  "624": "Guinea-Bissau",
  "328": "Guyana",
  "332": "Haiti",
  "340": "Honduras",
  "348": "Hungary",
  "352": "Iceland",
  "356": "India",
  "360": "Indonesia",
  "364": "Iran",
  "368": "Iraq",
  "372": "Ireland",
  "376": "Israel",
  "380": "Italy",
  "388": "Jamaica",
  "392": "Japan",
  "400": "Jordan",
  "398": "Kazakhstan",
  "404": "Kenya",
  "414": "Kuwait",
  "417": "Kyrgyzstan",
  "418": "Laos",
  "428": "Latvia",
  "422": "Lebanon",
  "426": "Lesotho",
  "430": "Liberia",
  "434": "Libya",
  "440": "Lithuania",
  "442": "Luxembourg",
  "807": "Macedonia",
  "450": "Madagascar",
  "454": "Malawi",
  "458": "Malaysia",
  "462": "Maldives",
  "466": "Mali",
  "470": "Malta",
  "478": "Mauritania",
  "480": "Mauritius",
  "484": "Mexico",
  "498": "Moldova",
  "496": "Mongolia",
  "499": "Montenegro",
  "504": "Morocco",
  "508": "Mozambique",
  "104": "Myanmar",
  "516": "Namibia",
  "524": "Nepal",
  "528": "Netherlands",
  "554": "New Zealand",
  "558": "Nicaragua",
  "562": "Niger",
  "566": "Nigeria",
  "408": "North Korea",
  "578": "Norway",
  "512": "Oman",
  "586": "Pakistan",
  "275": "Palestine",
  "591": "Panama",
  "598": "Papua New Guinea",
  "600": "Paraguay",
  "604": "Peru",
  "608": "Philippines",
  "616": "Poland",
  "620": "Portugal",
  "634": "Qatar",
  "642": "Romania",
  "643": "Russia",
  "646": "Rwanda",
  "682": "Saudi Arabia",
  "686": "Senegal",
  "688": "Serbia",
  "694": "Sierra Leone",
  "702": "Singapore",
  "703": "Slovakia",
  "705": "Slovenia",
  "706": "Somalia",
  "710": "South Africa",
  "410": "South Korea",
  "728": "S. Sudan",
  "724": "Spain",
  "144": "Sri Lanka",
  "729": "Sudan",
  "740": "Suriname",
  "748": "Swaziland",
  "752": "Sweden",
  "756": "Switzerland",
  "760": "Syria",
  "158": "Taiwan",
  "762": "Tajikistan",
  "834": "Tanzania",
  "764": "Thailand",
  "626": "Timor-Leste",
  "768": "Togo",
  "780": "Trinidad and Tobago",
  "788": "Tunisia",
  "792": "Turkey",
  "795": "Turkmenistan",
  "800": "Uganda",
  "804": "Ukraine",
  "784": "United Arab Emirates",
  "826": "United Kingdom",
  "840": "United States of America",
  "858": "Uruguay",
  "860": "Uzbekistan",
  "862": "Venezuela",
  "704": "Vietnam",
  "887": "Yemen",
  "894": "Zambia",
  "716": "Zimbabwe",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorldMapChart({ countries }: Props) {
  const [geoJson, setGeoJson] = useState<GeoFeatureCollection | null>(null);
  const [error, setError] = useState(false);
  const router = useRouter();

  // Fetch and register GeoJSON
  useEffect(() => {
    let cancelled = false;

    fetch(GEOJSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((topoData: Topology) => {
        if (cancelled) return;

        const geo = topoToGeo(topoData);

        // Ensure each feature has a name property
        for (const feature of geo.features) {
          if (!feature.properties) feature.properties = {};
          if (!feature.properties.name && feature.id) {
            const numericId = String(feature.id);
            feature.properties.name =
              ISO_NUMERIC_TO_NAME[numericId] ?? `Country ${numericId}`;
          }
        }

        echarts.registerMap("world", geo as never);
        setGeoJson(geo);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Build lookup: GeoJSON feature name -> { tier, qgiId }
  const nameToData = useMemo(() => {
    const map = new Map<
      string,
      { tier: RiskTier; id: string; name: string; alpha_2: string }
    >();

    for (const c of countries) {
      map.set(c.name, {
        tier: c.tier,
        id: c.id,
        name: c.name,
        alpha_2: c.alpha_2,
      });

      const geoName = QGI_TO_GEO[c.name];
      if (geoName && geoName !== c.name) {
        map.set(geoName, {
          tier: c.tier,
          id: c.id,
          name: c.name,
          alpha_2: c.alpha_2,
        });
      }
    }

    return map;
  }, [countries]);

  // Build ECharts series data
  const seriesData: SeriesItem[] = useMemo(() => {
    if (!geoJson) return [];

    return geoJson.features
      .map((f: GeoFeature): SeriesItem => {
        const featureName = String(f.properties?.name ?? "");
        let data = nameToData.get(featureName);
        if (!data) {
          const qgiName = GEO_TO_QGI[featureName];
          if (qgiName) data = nameToData.get(qgiName);
        }

        return {
          name: featureName,
          value: data ? TIER_VALUES[data.tier] : 0,
          tier: data?.tier ?? null,
          qgiId: data?.id ?? null,
          qgiName: data?.name ?? featureName,
          alpha2: data?.alpha_2 ?? "",
        };
      })
      .filter((d: SeriesItem) => d.name);
  }, [geoJson, nameToData]);

  // Handle country click
  const handleClick = useCallback(
    (params: { data?: { qgiId?: string | null } }) => {
      const qgiId = params.data?.qgiId;
      if (qgiId) {
        router.push(`/countries/${qgiId}`);
      }
    },
    [router]
  );

  // Tier legend counts
  const tierCounts = useMemo(() => {
    const counts: Record<RiskTier, number> = {
      HIGH: 0,
      MODERATE: 0,
      INDICATIVE: 0,
    };
    for (const c of countries) {
      counts[c.tier]++;
    }
    return counts;
  }, [countries]);

  // ECharts option
  const option = useMemo(() => {
    if (!geoJson) return {};

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "#1e2d42",
        borderColor: "#243347",
        textStyle: { color: "#e2e8f0", fontSize: 11 },
        formatter: (params: {
          data?: {
            qgiName?: string;
            tier?: RiskTier | null;
            alpha2?: string;
          };
        }) => {
          const d = params.data;
          if (!d || !d.tier) {
            return `<span style="color:#7a90a8">${d?.qgiName ?? "Unknown"}</span><br/><span style="font-size:10px;color:#556677">No data</span>`;
          }
          const color = TIER_COLORS[d.tier];
          return `<span style="font-weight:600">${d.qgiName}</span> <span style="font-size:10px;color:#7a90a8">${d.alpha2}</span><br/><span style="color:${color};font-weight:600;font-size:10px">${d.tier}</span>`;
        },
      },
      series: [
        {
          type: "map",
          map: "world",
          roam: true, // #3: zoom + pan enabled
          scaleLimit: { min: 1, max: 8 },
          aspectScale: 0.75,
          layoutCenter: ["50%", "55%"],
          layoutSize: "100%",
          // Fix antimeridian line (Russia wrapping through Greenland/Canada):
          // Shift the center slightly to avoid the seam
          center: [10, 20],
          selectedMode: false,
          emphasis: {
            label: { show: false },
            itemStyle: {
              areaColor: undefined,
              borderColor: "#e2e8f0",
              borderWidth: 1.5,
            },
          },
          itemStyle: {
            areaColor: NO_DATA_COLOR,
            borderColor: "#0d1b2a",
            borderWidth: 0.5,
          },
          label: { show: false },
          data: seriesData.map((d: SeriesItem) => ({
            name: d.name,
            value: d.value,
            qgiId: d.qgiId,
            qgiName: d.qgiName,
            alpha2: d.alpha2,
            tier: d.tier,
            itemStyle: d.tier
              ? {
                  areaColor: TIER_COLORS[d.tier],
                  opacity: 0.85,
                }
              : undefined,
            emphasis: d.tier
              ? {
                  itemStyle: {
                    areaColor: TIER_COLORS[d.tier],
                    opacity: 1,
                    borderColor: "#e2e8f0",
                    borderWidth: 1.5,
                  },
                }
              : {
                  itemStyle: {
                    areaColor: "#243347",
                  },
                },
          })),
        },
      ],
    };
  }, [geoJson, seriesData]);

  // Error state
  if (error) {
    return (
      <div
        style={{
          backgroundColor: "var(--qgi-bg)",
          padding: "16px",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 10, color: "var(--qgi-text-dim)" }}>
          Map data unavailable
        </span>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "var(--qgi-bg)", position: "relative" }}>
      {/* Header */}
      <div
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid var(--qgi-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "var(--qgi-text-dim)",
            }}
          >
            Global Risk Map
          </span>
          <span style={{ fontSize: 10, color: "var(--qgi-text-dim)" }}>
            {countries.length} countries
          </span>
        </div>

        {/* Tier legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {(["HIGH", "MODERATE", "INDICATIVE"] as RiskTier[]).map((tier) => (
            <div
              key={tier}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: TIER_COLORS[tier],
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  color: "var(--qgi-text-dim)",
                  fontFamily: "var(--font-data)",
                }}
              >
                {tier === "INDICATIVE" ? "IND" : tier} {tierCounts[tier]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Map body */}
      {!geoJson ? (
        <div
          style={{
            height: 250,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "var(--qgi-text-dim)",
              letterSpacing: "0.15em",
            }}
          >
            Loading map...
          </span>
        </div>
      ) : (
        <div style={{ height: 250 }}>
          <ReactEChartsWrapper
            option={option}
            onEvents={{ click: handleClick }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wrapper -- dynamically imports echarts-for-react to avoid SSR issues.
// Uses `any` for the component ref since echarts-for-react types are complex.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function ReactEChartsWrapper({
  option,
  onEvents,
}: {
  option: Record<string, unknown>;
  onEvents: Record<string, (params: any) => void>;
}) {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(
    null
  );

  useEffect(() => {
    import("echarts-for-react").then((mod) => {
      setComponent(() => mod.default as React.ComponentType<any>);
    });
  }, []);

  if (!Component) return null;

  return (
    <Component
      option={option}
      style={{ height: "100%", width: "100%" }}
      opts={{ renderer: "canvas" }}
      onEvents={onEvents}
    />
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
