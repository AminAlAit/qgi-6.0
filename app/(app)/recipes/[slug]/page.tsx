import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { HowToReadButton } from "@/components/te-v4-shared/HowToReadButton";
import {
  getAllRecipes,
  getRecipe,
  getMock,
  isDemoGraduated,
} from "@/lib/te-mock/recipes";
import {
  getRecipeV4Extras,
  getFallbackExtras,
  getCountriesFull,
} from "@/lib/te-mock/recipe-v4-1-mock";
import { statusLabel } from "@/lib/te-mock/country-families";
import { getShapeData } from "@/lib/te-mock/recipe-shape-mock";
import {
  getCorpusEvents,
  getTotalEventsInCorpus,
} from "@/lib/te-mock/precedents-corpus-mock";
import { getPattern } from "@/lib/te-mock/patterns-v4-data";
import recipeTracker from "@/data/recipe-tracker.json";

import { PageLayout } from "@/components/precedents-v4-1/PageLayout";
import { familyColor as familyColorFn } from "@/lib/te-mock/l1-families";
import {
  IndicatorSetPanel,
  WindowPanel,
  IdentityCardPanel,
  DiscriminationPanel,
} from "@/components/precedents-v4-1/MinorPanels";
import { CalibrationPanel } from "@/components/precedents-v4-1/CalibrationPanel";
import { CountriesPanel } from "@/components/precedents-v4-1/CountriesPanel";
import { ReliabilityPanel } from "@/components/precedents-v4-1/ReliabilityPanel";
import { ScoreDistributionPanel } from "@/components/precedents-v4-1/ScoreDistributionPanel";
import { PrecedentsTimelinePanel } from "@/components/precedents-v4-1/PrecedentsTimelinePanel";
import { PatternAlignmentPanel } from "@/components/precedents-v4-1/PatternAlignmentPanel";
import { IndicatorSensitivityPanel } from "@/components/precedents-v4-1/IndicatorSensitivityPanel";
import { ExpandableShell } from "@/components/te-v4-shared/ExpandableShell";

interface Params {
  params: Promise<{ slug: string }>;
}

interface RawTrackerRow {
  recipe_id: string;
  description_compelling?: string;
}

/**
 * Index `description_compelling` from the raw tracker JSON. Built at module
 * load so each detail render is a single Map lookup. Cascade-era recipes
 * carry the field directly on the row; TE recipes don't have a tracker row
 * (the tracker file pre-dates TE), so they fall through to the in-mock
 * definition. This is fine — TE recipes have hand-curated definitions in
 * CASCADE_MOCK_DATA where it matters and a generic fallback otherwise.
 */
const COMPELLING_BY_ID = new Map<string, string>();
for (const row of (recipeTracker as { recipes: RawTrackerRow[] }).recipes) {
  if (row.description_compelling) {
    COMPELLING_BY_ID.set(row.recipe_id, row.description_compelling);
  }
}

export async function generateStaticParams() {
  return getAllRecipes().map((r) => ({ slug: r.recipe_id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const recipe = getRecipe(slug);
  return {
    title: recipe
      ? `${recipe.label} · Recipes · QG Intelligence`
      : "Recipe not found · QG Intelligence",
    description: recipe
      ? `${recipe.label} recipe report card: indicator set, validation, results.`
      : "Recipe not found.",
  };
}

export default async function RecipeDetailV41Page({ params }: Params) {
  const { slug } = await params;
  const recipe = getRecipe(slug);
  if (!recipe) notFound();

  const mock = getMock(recipe);
  const extras = getRecipeV4Extras(slug) ?? getFallbackExtras(slug);
  const countriesFull = getCountriesFull(slug);
  const shapeData = getShapeData(slug);
  const corpusEvents = getCorpusEvents(slug);
  const totalEventsInCorpus = getTotalEventsInCorpus(slug);

  const demo = isDemoGraduated(recipe);
  const effectiveStatus = demo ? "graduated" : recipe.status;
  // V4.1 §0 (confidence-first) + #25: the Countries / Score-distribution /
  // Precedents panels should render whenever real scoring data exists, not
  // gate on `effectiveStatus === "graduated"`. A recipe that's "In play"
  // still has scored countries — withholding them undermines confidence.
  const showResults =
    effectiveStatus === "graduated" || (mock.countriesTop?.length ?? 0) > 0;
  const familyColor = familyColorFn(recipe.l1_id, recipe.l1_color);
  const hasTrajectory = !!getPattern(slug);

  // V4.1 §4: V4.1 status chip. Replaces "Tested, did not hold up" /
  // "Walked, not graduated" with "In play" — confident, true, not exposing.
  const v41StatusLabel = statusLabel(effectiveStatus);
  const v41StatusColor =
    v41StatusLabel.tone === "deployed"
      ? "#3FBF8F"
      : v41StatusLabel.tone === "failed"
        ? "#5B7E99"
        : v41StatusLabel.label === "Coming soon" ||
            v41StatusLabel.label === "Prior version"
          ? "#7A8FA0"
          : "#5B7E99";
  const v41StatusChip = (
    <span
      style={{
        padding: "5px 12px",
        fontSize: "12px",
        border: `1px solid ${v41StatusColor}`,
        color: v41StatusColor,
        backgroundColor: `${v41StatusColor}26`,
        borderRadius: "4px",
        letterSpacing: "0.3px",
        fontFamily: "ui-monospace, monospace",
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        whiteSpace: "nowrap",
      }}
    >
      {v41StatusLabel.label}
    </span>
  );

  // The honest demo disclosure used to sit here. Founder #1 (2026-05-28) said
  // the vacate/leak narrative belongs on /recipe-tracker + the blog, not on
  // user-facing recipe pages. We surface a compact pointer when the recipe
  // is the special demo case; otherwise nothing.
  const demoDisclosure = demo ? (
    <div
      data-tour="demo-disclosure"
      style={{
        padding: "8px 12px",
        border: `1px dashed ${familyColor}`,
        background: `${familyColor}11`,
        borderRadius: "4px",
        fontSize: "11.5px",
        lineHeight: 1.5,
        color: "var(--qgi-text-muted)",
        fontFamily: "ui-monospace, monospace",
        maxWidth: "780px",
      }}
    >
      Demo render of the fully-populated detail page. Latest status of the live recipe
      lives on{" "}
      <Link href={"/recipe-tracker" as Route} style={{ color: familyColor }}>
        /recipe-tracker
      </Link>
      .
    </div>
  ) : null;

  // LOCO-AUC + CI for the discrimination panel.
  const locoAuc = demo ? 0.9147 : (recipe.stats?.loco_auc ?? null);
  const ciLow = demo ? 0.872 : undefined;
  const ciHigh = demo ? 0.948 : undefined;

  const enrichedIndicators =
    extras.indicators.length > 0
      ? extras.indicators
      : mock.indicators.map((i) => ({
          ...i,
          shapWeightPct: 100 / Math.max(1, mock.indicators.length),
          aucDrop: 0,
        }));

  const recipeWithColor = { ...recipe, l1_color: familyColor };

  // V4.1 §A1 — prefer the compelling description; fall through to the
  // dry mock definition for back-compat (TE recipes without a tracker row).
  const heroDefinition = COMPELLING_BY_ID.get(slug) ?? mock.definition;

  return (
    <PageLayout
      recipe={recipeWithColor}
      statusChip={v41StatusChip}
      subtitle={`${enrichedIndicators.length} signals · ${mock.window}y window`}
      definition={heroDefinition}
      demoDisclosure={demoDisclosure}
      headerRightSlot={<HowToReadButton routeKey="recipes-v4.1-detail" />}
    >
      {/*
        Panel order — pedagogical sort:
          1. STRUCTURE   IdentityCard (incl. corpus size) · IndicatorSet · Window
          2. VALIDATION  Discrimination · Reliability · Calibration
          3. RESULTS     CountriesPanel · ScoreDistribution
          4. DEEP-DIVE   Precedents · TrajectoryAlignment · IndicatorSensitivity
      */}

      {/* 1. STRUCTURE */}
      <IdentityCardPanel
        familyColor={familyColor}
        l1_label={recipe.l1_label}
        l2_label={recipe.l2_label}
        nIndicators={enrichedIndicators.length}
        status={recipe.status}
        nPositives={mock.nPositives ?? 0}
        thresholdMet={(mock.nPositives ?? 0) >= extras.threshold}
      />
      <IndicatorSetPanel familyColor={familyColor} indicators={enrichedIndicators} />
      <WindowPanel
        familyColor={familyColor}
        windowYears={mock.window}
        ciLow={3}
        ciHigh={25}
      />

      {/* 2. VALIDATION (does it work) */}
      <DiscriminationPanel
        familyColor={familyColor}
        locoAuc={locoAuc}
        ciLow={ciLow}
        ciHigh={ciHigh}
        showResults={showResults}
      />
      <ReliabilityPanel
        familyColor={familyColor}
        v1SeparationPp={extras.reliability.v1SeparationPp}
        v4OotRecallPct={extras.reliability.v4OotRecallPct}
        walksCompleted={extras.reliability.walksCompleted}
        verdict={extras.reliability.verdict}
      />
      <CalibrationPanel familyColor={familyColor} showCalibrationData={false} />

      {/* 3. RESULTS (what does it find) */}
      <CountriesPanel
        familyColor={familyColor}
        countriesTop={mock.countriesTop}
        countriesBottom={extras.countriesBottom}
        countriesFull={countriesFull}
        showResults={showResults}
      />
      <ExpandableShell familyColor={familyColor} label="Score distribution">
        <ScoreDistributionPanel
          familyColor={familyColor}
          histogram={extras.distribution.histogram}
          median={extras.distribution.median}
          p90={extras.distribution.p90}
          p99={extras.distribution.p99}
          max={extras.distribution.max}
          countriesFull={countriesFull}
        />
      </ExpandableShell>

      {/* 4. DEEP-DIVE (anatomy of the prediction) */}
      <ExpandableShell familyColor={familyColor} label="Precedents">
        <PrecedentsTimelinePanel
          familyColor={familyColor}
          events={corpusEvents}
          totalEventsInCorpus={totalEventsInCorpus || (mock.nPositives ?? 0)}
        />
      </ExpandableShell>
      <ExpandableShell familyColor={familyColor} label="Trajectory alignment">
        <PatternAlignmentPanel
          familyColor={familyColor}
          recipeId={recipe.recipe_id}
          windowYears={mock.window}
          indicators={enrichedIndicators}
          shapeData={shapeData}
          hasTrajectory={hasTrajectory}
        />
      </ExpandableShell>
      <ExpandableShell familyColor={familyColor} label="Indicator sensitivity">
        <IndicatorSensitivityPanel
          familyColor={familyColor}
          indicators={enrichedIndicators.map((i) => ({
            code: i.code,
            name: i.name,
            provider: i.provider,
            aucDrop: i.aucDrop,
          }))}
        />
      </ExpandableShell>
    </PageLayout>
  );
}
