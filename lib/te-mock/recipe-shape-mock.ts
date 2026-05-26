/**
 * recipe-shape-mock — per-indicator canonical-shape mock data feeding
 * PatternAlignmentPanel. Each indicator gets {mean, p25, p75} arrays of
 * length windowYears (one entry per year leading to the event).
 *
 * Wireframe data, not live walk output.
 *
 * — Daniyar Bekmurat, Comparative Historical Pattern Matching
 */
import type { AlignmentShape } from "@/components/precedents-v4-1/PatternAlignmentPanel";

function shape(
  windowYears: number,
  direction: 1 | -1,
  baseline: number,
  curvature: number,
  spread: number,
  seed: number
): AlignmentShape {
  const mean: number[] = [];
  const p25: number[] = [];
  const p75: number[] = [];
  for (let i = 0; i < windowYears; i++) {
    const t = i / Math.max(1, windowYears - 1);
    const m =
      baseline +
      direction * curvature * (0.4 * t + 0.6 * Math.pow(t, 1.6)) +
      0.08 * Math.sin(t * Math.PI * 2 * (1 + (seed % 3) * 0.4) + seed);
    const s = spread * (0.7 + 0.45 * t);
    mean.push(Number(m.toFixed(3)));
    p25.push(Number((m - s).toFixed(3)));
    p75.push(Number((m + s).toFixed(3)));
  }
  return { indicatorCode: "__UNSET__", mean, p25, p75 };
}

const FOREIGN_INTERVENTION_WINDOW = 18;
const foreignInterventionShapes: AlignmentShape[] = [
  {
    ...shape(FOREIGN_INTERVENTION_WINDOW, -1, 0.35, 1.7, 0.45, 1),
    indicatorCode: "RQ.EST",
  },
  {
    ...shape(FOREIGN_INTERVENTION_WINDOW, -1, 0.1, 1.3, 0.55, 2),
    indicatorCode: "v2pepwrgen",
  },
  {
    ...shape(FOREIGN_INTERVENTION_WINDOW, -1, 0.5, 1.9, 0.4, 3),
    indicatorCode: "v2stfisccap",
  },
  {
    ...shape(FOREIGN_INTERVENTION_WINDOW, -1, -0.15, 1.5, 0.5, 4),
    indicatorCode: "v2elintmon",
  },
];

const CIVIL_WAR_WINDOW = 12;
const civilWarShapes: AlignmentShape[] = [
  { ...shape(CIVIL_WAR_WINDOW, -1, 0.25, 1.6, 0.42, 5), indicatorCode: "RQ.EST" },
  { ...shape(CIVIL_WAR_WINDOW, -1, 0.15, 1.4, 0.5, 6), indicatorCode: "v2x_polyarchy" },
  { ...shape(CIVIL_WAR_WINDOW, -1, 0.05, 1.8, 0.55, 7), indicatorCode: "v2psoppaut" },
];

const CONSTITUTIONAL_WINDOW = 6;
const constitutionalChangeShapes: AlignmentShape[] = [
  { ...shape(CONSTITUTIONAL_WINDOW, 1, -0.2, 1.4, 0.35, 8), indicatorCode: "v2lginvstp" },
  { ...shape(CONSTITUTIONAL_WINDOW, -1, 0.1, 1.2, 0.45, 9), indicatorCode: "v2juncind" },
  {
    ...shape(CONSTITUTIONAL_WINDOW, 1, -0.05, 1.0, 0.4, 10),
    indicatorCode: "v2x_polyarchy",
  },
  { ...shape(CONSTITUTIONAL_WINDOW, -1, 0.25, 1.3, 0.38, 11), indicatorCode: "RQ.EST" },
  { ...shape(CONSTITUTIONAL_WINDOW, 1, 0.0, 1.1, 0.42, 12), indicatorCode: "v2csprtcpt" },
];

const SHAPE_DATA: Record<string, AlignmentShape[]> = {
  foreign_intervention: foreignInterventionShapes,
  civil_war_and_insurgency: civilWarShapes,
  constitutional_change: constitutionalChangeShapes,
};

export function getShapeData(recipeId: string): AlignmentShape[] {
  return SHAPE_DATA[recipeId] ?? [];
}
