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
import {
  getRecipeV4Extras,
  getFallbackExtras,
  getCountriesFull,
} from "@/lib/te-mock/recipe-v4-1-mock";
import { getShapeData } from "@/lib/te-mock/recipe-shape-mock";
import {
  getCorpusEvents,
  getTotalEventsInCorpus,
} from "@/lib/te-mock/precedents-corpus-mock";

import { PageLayout } from "@/components/precedents-v4-1/PageLayout";
import { StatusChip, STATUS_META } from "@/components/precedents-v2/StatusChip";
import {
  IndicatorSetPanel,
  WindowPanel,
  IdentityCardPanel,
  DiscriminationPanel,
  PatternCrossLinkFooter,
} from "@/components/precedents-v4-1/MinorPanels";
import { CalibrationPanel } from "@/components/precedents-v4-1/CalibrationPanel";
import { CountriesPanel } from "@/components/precedents-v4-1/CountriesPanel";
// SampleSizePanel deprecated 2026-05-27 (#161 — folded into IdentityCardPanel
// as "Real-world cases" + eligibility chip). File retained, no longer imported.
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
      "Recipe report-card mockup V4.1: dashboard panel grid, L1-color accent, honesty via tooltips. Local-only, not for production.",
    robots: { index: false, follow: false },
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
      <strong>{STATUS_META[recipe.status].label.toLowerCase()}</strong>. Graduation
      withdrawn on 2026-05-25 after a sample-coverage error was found during review.
      Re-evaluation in progress. Rendered as graduated here so you can see what a
      populated page looks like. Up-to-date status lives on{" "}
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
      definition={mock.definition}
      demoDisclosure={demoDisclosure}
    >
      {/*
        ──────────────────────────────────────────────────────────────────
        Panel order — pedagogical sort (#164 part 1 — Sofia 2026-05-27).
        Reader's journey: STRUCTURE → VALIDATION → RESULTS → DEEP-DIVE.

          1. STRUCTURE   IdentityCard (incl. corpus size) · IndicatorSet · Window
          2. VALIDATION  Discrimination · Reliability · Calibration
          3. RESULTS     CountriesPanel · ScoreDistribution
          4. DEEP-DIVE   Precedents · PatternAlignment · IndicatorSensitivity

        IdentityCard leads because it answers "what is this recipe and is
        it ready to be evaluated" before the reader spends attention on the
        indicator stack. Calibration moves up into VALIDATION (it's a
        trustworthiness concern, not a results display). TallSlot wraps
        panels whose natural height exceeds one grid row (IndicatorSet,
        Countries, ScoreDistribution, Precedents, PatternAlignment) so the
        grid's dense flow packs short panels into the leftover cells.
        ────────────────────────────────────────────────────────────────── */}

      {/* ─── 1. STRUCTURE ──────────────────────────────────────────────── */}
      <IdentityCardPanel
        familyColor={familyColor}
        l1_id={recipe.l1_id}
        l1_label={recipe.l1_label}
        l2_label={recipe.l2_label}
        nIndicators={enrichedIndicators.length}
        status={recipe.status}
        vintage={vintageStamp()}
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

      {/* ─── 2. VALIDATION (does it work) ──────────────────────────────── */}
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

      {/* ─── 3. RESULTS (what does it find) ────────────────────────────── */}
      {/* Combined top-5 + bottom-5 panel with internal "Full list" toggle
          (#158 — Talia 2026-05-26). NOT wrapped in ExpandableShell — owns
          its own expand surface. */}
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
        />
      </ExpandableShell>

      {/* ─── 4. DEEP-DIVE (anatomy of the prediction) ──────────────────── */}
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
