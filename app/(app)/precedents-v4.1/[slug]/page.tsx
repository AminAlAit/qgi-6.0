import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import {
  getAllRecipes,
  getRecipe,
  getMock,
  isDemoGraduated,
  vintageStamp,
} from "@/lib/te-mock/recipes";
import { getRecipeV4Extras, getFallbackExtras } from "@/lib/te-mock/recipe-v4-1-mock";
import { getShapeData } from "@/lib/te-mock/recipe-shape-mock";
import {
  getCorpusEvents,
  getTotalEventsInCorpus,
} from "@/lib/te-mock/precedents-corpus-mock";

import { PageLayout } from "@/components/precedents-v4-1/PageLayout";
import { StatusChip, STATUS_META } from "@/components/precedents-v2/StatusChip";
import {
  DefinitionPanel,
  IndicatorSetPanel,
  WindowPanel,
  IdentityCardPanel,
  DiscriminationPanel,
  TopCountriesPanel,
  BottomCountriesPanel,
  CalibrationPanel,
  PatternCrossLinkFooter,
} from "@/components/precedents-v4-1/MinorPanels";
import { SampleSizePanel } from "@/components/precedents-v4-1/SampleSizePanel";
import { ReliabilityPanel } from "@/components/precedents-v4-1/ReliabilityPanel";
import { ScoreDistributionPanel } from "@/components/precedents-v4-1/ScoreDistributionPanel";
import { PrecedentsTimelinePanel } from "@/components/precedents-v4-1/PrecedentsTimelinePanel";
import { PatternAlignmentPanel } from "@/components/precedents-v4-1/PatternAlignmentPanel";
import { IndicatorSensitivityPanel } from "@/components/precedents-v4-1/IndicatorSensitivityPanel";
import { ExpandableShell } from "@/components/te-v4-shared/ExpandableShell";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllRecipes().map((r) => ({ slug: r.recipe_id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const recipe = getRecipe(slug);
  return {
    title: recipe
      ? `${recipe.label} · Recipes V4.1 · QG Intelligence`
      : "Recipe not found · QG Intelligence",
    description:
      "Recipe report-card mockup V4.1 — dashboard panel grid, L1-color accent, honesty via tooltips. Local-only, not for production.",
    robots: { index: false, follow: false },
  };
}

export default async function RecipeDetailV41Page({ params }: Params) {
  const { slug } = await params;
  const recipe = getRecipe(slug);
  if (!recipe) notFound();

  const mock = getMock(recipe);
  const extras = getRecipeV4Extras(slug) ?? getFallbackExtras(slug);
  const shapeData = getShapeData(slug);
  const corpusEvents = getCorpusEvents(slug);
  const totalEventsInCorpus = getTotalEventsInCorpus(slug);

  const demo = isDemoGraduated(recipe);
  const effectiveStatus = demo ? "graduated" : recipe.status;
  const showResults = effectiveStatus === "graduated";
  const familyColor = recipe.l1_color;

  // For the demo (foreign_intervention) we render with results visible but
  // surface the "real status" disclosure in the header. The full M8-R5
  // honesty obligation now lives in tooltips on score chips + dual section-
  // pending copy — no inline brand text anywhere on the page.
  const demoDisclosure = demo ? (
    <div
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
      <strong style={{ color: familyColor }}>Demo render.</strong> Real status:{" "}
      <strong>{STATUS_META[recipe.status].label.toLowerCase()}</strong> (graduation
      vacated 2026-05-25 — sample-truncation leak; prior LOCO-AUC 0.9147 reduced to ≈0.50
      on full history). Rendered as graduated to show what a populated page looks like.
      Truth lives on{" "}
      <Link href={"/recipe-tracker" as Route} style={{ color: familyColor }}>
        /recipe-tracker
      </Link>
      .
    </div>
  ) : null;

  // LOCO-AUC + CI for the discrimination panel. For demo (foreign_intervention)
  // use the pre-vacate 0.9147 number with its CI. For real walked recipes,
  // pull from recipe.stats.
  const locoAuc = demo ? 0.9147 : (recipe.stats?.loco_auc ?? null);
  const ciLow = demo ? 0.872 : undefined;
  const ciHigh = demo ? 0.948 : undefined;

  // Indicators for the IndicatorSet + Sensitivity panels. Extras has the
  // weighted version; fall back to mock.indicators if extras are empty.
  const enrichedIndicators =
    extras.indicators.length > 0
      ? extras.indicators
      : mock.indicators.map((i) => ({
          ...i,
          shapWeightPct: 100 / Math.max(1, mock.indicators.length),
          aucDrop: 0,
        }));

  return (
    <PageLayout
      recipe={recipe}
      statusChip={<StatusChip status={effectiveStatus} size="md" />}
      subtitle={`${enrichedIndicators.length} indicators · ${mock.window}y window`}
      demoDisclosure={demoDisclosure}
    >
      {/* ─── Anatomy backbone ──────────────────────────────────────────── */}
      <DefinitionPanel familyColor={familyColor} definition={mock.definition} />
      <IndicatorSetPanel familyColor={familyColor} indicators={enrichedIndicators} />
      <WindowPanel
        familyColor={familyColor}
        windowYears={mock.window}
        ciLow={3}
        ciHigh={25}
      />
      <IdentityCardPanel
        familyColor={familyColor}
        l1_id={recipe.l1_id}
        l1_label={recipe.l1_label}
        l2_label={recipe.l2_label}
        windowYears={mock.window}
        nIndicators={enrichedIndicators.length}
        status={recipe.status}
        walkId={extras.walkId}
        walkNumber={extras.walkNumber}
        cohortDef={extras.cohortDef}
        ratifiedBy={extras.ratifiedBy}
        walkDate={extras.walkDate}
        vintage={vintageStamp()}
      />
      <SampleSizePanel
        familyColor={familyColor}
        nPositives={mock.nPositives ?? 0}
        nCohorts={extras.nCohorts}
        thresholdMet={(mock.nPositives ?? 0) >= extras.threshold}
        threshold={extras.threshold}
      />

      {/* ─── Results panels (gated for non-demo non-graduated) ─────────── */}
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
      <TopCountriesPanel
        familyColor={familyColor}
        countries={mock.countriesTop}
        showResults={showResults}
      />
      <BottomCountriesPanel
        familyColor={familyColor}
        countries={extras.countriesBottom}
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
        />
      </ExpandableShell>
      <CalibrationPanel familyColor={familyColor} showCalibrationData={false} />

      {/* ─── Trajectory + corpus + sensitivity ─────────────────────────── */}
      <ExpandableShell familyColor={familyColor} label="Precedents timeline">
        <PrecedentsTimelinePanel
          familyColor={familyColor}
          events={corpusEvents}
          totalEventsInCorpus={totalEventsInCorpus || (mock.nPositives ?? 0)}
        />
      </ExpandableShell>
      <ExpandableShell familyColor={familyColor} label="Pattern alignment">
        <PatternAlignmentPanel
          familyColor={familyColor}
          recipeId={recipe.recipe_id}
          windowYears={mock.window}
          indicators={enrichedIndicators}
          shapeData={shapeData}
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

      <PatternCrossLinkFooter familyColor={familyColor} recipeId={recipe.recipe_id} />
    </PageLayout>
  );
}
