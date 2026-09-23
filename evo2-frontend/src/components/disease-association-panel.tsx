"use client";

import { useId, useState } from "react";
import {
  predictDiseaseAssociationWithAPI,
  type VariantAnalysisResult,
} from "~/utils/genome-api";
import {
  historicalRankingPolicy,
  rankingPolicyMessage,
  RESEARCH_WARNING,
} from "~/lib/disease-ranking-policy";
import { Button } from "./ui/button";

interface DiseaseAssociationPanelProps {
  result: VariantAnalysisResult;
}

type Association = VariantAnalysisResult["disease_association"];

const statusCopy = {
  plan_locked: {
    title: "Researcher feature",
    description: "Disease-association exploration is included with Researcher. Variant classification is shown above.",
    badge: "Plan access",
  },
  available: {
    title: "Research hypotheses available",
    description: "Compare model rankings with the curated evidence below.",
    badge: "Exploratory",
  },
  skipped_benign: {
    title: "Disease ranking skipped",
    description: "",
    badge: "Not run",
  },
  skipped_uncertain: {
    title: "Uncertain significance",
    description:
      "Disease ranking is off by default. You can choose to explore research hypotheses below.",
    badge: "Not run",
  },
  exploratory_uncertain: {
    title: "Exploring an uncertain variant",
    description:
      "These results do not resolve the variant's uncertain significance.",
    badge: "Exploratory",
  },
  unsupported_gene: {
    title: "Ranking unavailable for this gene",
    description:
      "The model does not support this gene. Any available curated evidence is retained below.",
    badge: "Unavailable",
  },
  no_evidence_found: {
    title: "No association results available",
    description:
      "No exact curated match or usable model ranking was found. Missing evidence does not establish benignity.",
    badge: "No results",
  },
  model_unavailable: {
    title: "Disease ranking unavailable",
    description:
      "The model could not complete this request. Any available curated evidence is retained below.",
    badge: "Unavailable",
  },
} satisfies Record<
  Association["status"],
  { title: string; description: string; badge: string }
>;

export function DiseaseAssociationPanel({
  result,
}: DiseaseAssociationPanelProps) {
  return (
    <DiseaseAssociationContent
      key={`${result.normalized_variant.assembly}:${result.variant_key}:${result.evo2.prediction}`}
      result={result}
    />
  );
}

function DiseaseAssociationContent({
  result: original,
}: DiseaseAssociationPanelProps) {
  const headingId = useId();
  const [explored, setExplored] = useState<VariantAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const result = explored ?? original;
  const association = result.disease_association;
  const interpretation = association.final_interpretation;
  const policy = historicalRankingPolicy(
    result.evo2.prediction,
    interpretation,
  );
  const skipped = policy === "skipped_benign" || policy === "skipped_uncertain";
  const locked = association.status === "plan_locked";
  const status = policy === "skipped_benign" ? policy : locked ? "plan_locked" : skipped ? policy : association.status;
  const copy = statusCopy[status];
  const ranking = skipped || locked ? [] : association.disease_model_ranking.slice(0, 5);
  const currentInterpretation =
    interpretation?.ranking_policy_version === 1 ? interpretation : null;
  const conflict = currentInterpretation?.level === "conflicting";
  const canExplore = !locked && (
    policy === "skipped_uncertain" ||
    (policy === "exploratory_uncertain" && status === "model_unavailable"));
  const warnings = [...new Set(association.warnings)].filter(
    (warning) =>
      warning !== RESEARCH_WARNING &&
      warning !== rankingPolicyMessage(policy, result.evo2.prediction),
  );

  async function explore() {
    setLoading(true);
    setError(null);
    const variant = result.normalized_variant;
    try {
      setExplored(
        await predictDiseaseAssociationWithAPI({
          variant_position: variant.pos,
          reference: variant.ref,
          alternative: variant.alt,
          genome: variant.assembly,
          chromosome: variant.chrom,
          gene: variant.gene ?? undefined,
          explore_disease_associations: true,
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Research exploration failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-labelledby={headingId}
      className="border-border/70 mt-6 border-t pt-6"
    >
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4
            id={headingId}
            className="text-foreground text-base font-semibold tracking-tight"
          >
            Disease association
          </h4>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Curated evidence and exploratory model results.
          </p>
        </div>
        <span className="border-border bg-background text-muted-foreground rounded-full border px-2.5 py-1 text-[11px] font-medium">
          Research use only
        </span>
      </header>

      <div className="border-border/70 bg-muted/40 rounded-xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h5 className="text-foreground text-sm font-semibold">
            {copy.title}
          </h5>
          <span className="bg-background text-muted-foreground rounded-md px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider uppercase">
            {copy.badge}
          </span>
        </div>
        <p className="text-muted-foreground mt-2 max-w-[72ch] text-sm leading-relaxed">
          {policy === "skipped_benign"
            ? `Evo2 predicts this variant to be ${result.evo2.classification.toLowerCase()}. Automatic ML disease ranking was skipped.${locked ? "" : " Curated evidence remains available below."}`
            : copy.description}
        </p>
        {locked && policy !== "skipped_benign" && <a href="/settings?section=plan" className="text-phosphor mt-3 inline-block text-sm underline">View Researcher plan</a>}
        {canExplore && (
          <div className="border-border/70 mt-4 border-t pt-4">
            <p className="text-muted-foreground max-w-[72ch] text-xs leading-relaxed">
              {RESEARCH_WARNING}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={explore}
              className="mt-4 h-auto min-h-10 w-full rounded-lg px-4 py-2 text-xs whitespace-normal shadow-none transition-transform active:scale-[0.98] motion-reduce:transition-none sm:w-auto"
            >
              {loading
                ? "Generating research hypotheses..."
                : status === "model_unavailable"
                  ? "Retry research exploration"
                  : "Explore research hypotheses"}
            </Button>
            {error && (
              <p role="alert" className="text-destructive mt-3 text-sm">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {conflict && (
        <aside
          className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"
          aria-label="Conflicting evidence"
        >
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            Evidence needs review
          </p>
          <p className="text-foreground mt-1.5 text-sm leading-relaxed">
            {currentInterpretation.message}
          </p>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            {currentInterpretation.confidence_explanation}
          </p>
        </aside>
      )}

      <div
        className={`mt-6 grid min-w-0 gap-6 ${!skipped ? "md:grid-cols-2 md:gap-8" : ""}`}
      >
        <CuratedEvidence evidence={association.clinvar_evidence} />
        {!skipped && <ResearchRankings ranking={ranking} />}
      </div>

      {loading && (
        <div
          role="status"
          aria-label="Generating research hypotheses"
          className="border-border/70 mt-5 space-y-3 rounded-xl border p-4"
        >
          <div className="bg-muted h-3 w-40 rounded motion-safe:animate-pulse" />
          <div className="bg-muted h-3 w-3/4 rounded motion-safe:animate-pulse" />
          <div className="bg-muted h-3 w-1/2 rounded motion-safe:animate-pulse" />
          <span className="sr-only">
            Generating research hypotheses. Curated evidence remains available.
          </span>
        </div>
      )}

      {warnings.length > 0 && (
        <aside
          className="mt-5 border-l-2 border-amber-500/50 pl-3"
          aria-label="Evidence warnings"
        >
          <h5 className="text-foreground text-xs font-semibold">
            Evidence notes
          </h5>
          <ul className="text-muted-foreground mt-2 space-y-2 text-xs leading-relaxed">
            {warnings.map((warning) => (
              <li key={warning} className="break-words">
                {warning}
              </li>
            ))}
          </ul>
        </aside>
      )}

      <footer className="border-border/70 mt-6 border-t pt-4">
        <p className="text-muted-foreground text-xs leading-relaxed">
          Evo2 provides a computational prediction, not a clinical
          classification or diagnosis.
        </p>
        <details className="group mt-3 text-xs">
          <summary className="text-foreground focus-visible:ring-ring flex w-fit cursor-pointer list-none items-center gap-2 rounded-sm font-medium outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden="true"
              className="size-1.5 -rotate-45 border-r border-b border-current transition-transform group-open:rotate-45 motion-reduce:transition-none"
            />
            Interpretation &amp; scope
          </summary>
          <div className="text-muted-foreground mt-3 max-w-[72ch] space-y-2 leading-relaxed">
            {currentInterpretation && !conflict && (
              <>
                <p>{currentInterpretation.message}</p>
                <p>{currentInterpretation.confidence_explanation}</p>
              </>
            )}
            <p>
              This workflow concerns Mendelian disease. Drug response and
              complex-disease risk require separate interpretation.
            </p>
            <p className="font-mono text-[11px] break-all">
              {result.normalized_variant.assembly} / {result.variant_key}
            </p>
          </div>
        </details>
      </footer>
    </section>
  );
}

function CuratedEvidence({
  evidence,
}: {
  evidence: Association["clinvar_evidence"];
}) {
  return (
    <section className="min-w-0" aria-label="Curated ClinVar evidence">
      <div className="border-border/70 flex items-center justify-between gap-3 border-b pb-3">
        <div>
          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
            Curated source
          </p>
          <h5 className="text-foreground mt-1 text-sm font-semibold">
            ClinVar evidence
          </h5>
        </div>
        <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 font-mono text-xs tabular-nums">
          {evidence.length} {evidence.length === 1 ? "record" : "records"}
        </span>
      </div>
      {evidence.length ? (
        <ul className="divide-border/60 divide-y">
          {evidence.map((item) => (
            <li
              key={`${item.disease_name}-${item.variation_id ?? ""}-${item.clinical_significance}-${item.review_status}-${item.source}`}
              className="py-4 last:pb-0"
            >
              <p className="text-foreground text-sm leading-relaxed font-medium break-words">
                {item.disease_name}
              </p>
              <span className="border-border bg-muted/30 text-foreground mt-2 inline-block rounded-md border px-2 py-1 text-[11px] font-medium">
                {item.clinical_significance ?? "Unknown significance"}
              </span>
              <p className="text-muted-foreground mt-2.5 text-xs leading-relaxed">
                {item.review_status ?? "Review status not supplied"}
              </p>
              <dl className="text-muted-foreground mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[11px] leading-relaxed">
                <dt>Source</dt>
                <dd className="break-words">
                  {item.variation_id && /^\d+$/.test(item.variation_id) ? (
                    <a
                      className="decoration-border hover:text-foreground focus-visible:outline-ring underline underline-offset-4 focus-visible:outline-2"
                      href={`https://www.ncbi.nlm.nih.gov/clinvar/variation/${item.variation_id}/`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.source} / {item.variation_id}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    item.source
                  )}
                </dd>
                <dt>Last evaluated</dt>
                <dd>{item.last_evaluated ?? "Not supplied"}</dd>
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-6 sm:py-7">
          <p className="text-foreground text-sm font-medium">
            No exact match available
          </p>
          <p className="text-muted-foreground mt-2 max-w-[52ch] text-xs leading-relaxed">
            No exact variant evidence is available in the local ClinVar lookup.
            Missing evidence does not establish benignity.
          </p>
        </div>
      )}
    </section>
  );
}

function ResearchRankings({
  ranking,
}: {
  ranking: Association["disease_model_ranking"];
}) {
  return (
    <section className="min-w-0" aria-label="Exploratory ML disease rankings">
      <div className="border-border/70 border-b pb-3">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
          Model hypotheses
        </p>
        <h5 className="text-foreground mt-1 text-sm font-semibold">
          ML disease ranking
        </h5>
      </div>
      <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
        {RESEARCH_WARNING}
      </p>
      {ranking.length ? (
        <>
          <div className="border-border/50 text-muted-foreground mt-4 flex justify-between border-b pb-2 text-[10px] font-medium tracking-wider uppercase">
            <span>Candidate condition</span>
            <span>Model score</span>
          </div>
          <ol className="divide-border/60 divide-y">
            {ranking.map((item, index) => (
              <li
                key={item.disease_name}
                className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-baseline gap-2 py-3.5"
              >
                <span
                  aria-hidden="true"
                  className="text-muted-foreground font-mono text-[10px] tabular-nums"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-foreground text-xs leading-relaxed break-words">
                  {item.disease_name}
                </span>
                <span className="text-foreground font-mono text-xs font-medium tabular-nums">
                  {item.association_score.toFixed(3)}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
            Uncalibrated ranking scores. Higher does not mean a greater personal
            disease risk.
          </p>
        </>
      ) : (
        <p className="text-muted-foreground py-6 text-sm">
          No usable ML ranking was returned.
        </p>
      )}
    </section>
  );
}
