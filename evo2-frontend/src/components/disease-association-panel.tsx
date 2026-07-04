"use client";

import { Activity, AlertTriangle, Database, Info } from "lucide-react";

import type { VariantAnalysisResult } from "~/utils/genome-api";

interface DiseaseAssociationPanelProps {
  result: VariantAnalysisResult;
}

const levelStyles: Record<
  NonNullable<VariantAnalysisResult["final_interpretation"]>["level"],
  string
> = {
  strong: "border-red-500/30 bg-red-500/10 text-red-700",
  conflicting: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  possible: "border-blue-500/30 bg-blue-500/10 text-blue-700",
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  insufficient: "border-muted-foreground/20 bg-muted/60 text-muted-foreground",
};

const statusMessages: Record<
  Exclude<VariantAnalysisResult["disease_association"]["status"], "available">,
  { title: string; body: string }
> = {
  unsupported_gene: {
    title: "Disease association unavailable",
    body: "The custom disease model is not configured for this gene. Evo2 pathogenicity is shown above.",
  },
  no_evidence_found: {
    title: "No disease evidence found",
    body: "No curated disease evidence or usable disease ranking was found for this SNV. No disease result was inferred.",
  },
  model_unavailable: {
    title: "Disease model unavailable",
    body: "The disease association model could not run. Evo2 pathogenicity is shown above.",
  },
};

export function DiseaseAssociationPanel({ result }: DiseaseAssociationPanelProps) {
  const diseaseAssociation = result.disease_association;
  const topRanking = diseaseAssociation.disease_model_ranking.slice(0, 5);
  const interpretation = diseaseAssociation.final_interpretation;

  return (
    <div className="mt-5 border-t border-border/50 pt-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium text-foreground">
            Disease Association
          </h4>
          <div className="mt-1 text-xs text-muted-foreground">
            Curated ClinVar evidence and ML disease ranking are reported separately
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
          <Database className="h-3 w-3" />
          {diseaseAssociation.status === "available" ? "Available" : "Optional"}
        </div>
      </div>

      {diseaseAssociation.status !== "available" ? (
        <div className="rounded-md border border-border/50 bg-muted/50 p-4 text-sm">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium text-foreground">
                {statusMessages[diseaseAssociation.status].title}
              </div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {statusMessages[diseaseAssociation.status].body}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {interpretation ? (
        <div
          className={`mb-4 rounded-md border p-3 text-xs ${levelStyles[interpretation.level]}`}
        >
          <div className="font-medium">{interpretation.message}</div>
          <div className="mt-1 leading-relaxed">
            {interpretation.confidence_explanation}
          </div>
          <div className="mt-2 font-medium">{interpretation.warning}</div>
        </div>
      ) : null}

      {diseaseAssociation.status === "available" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-md border border-border/50 bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              Exact ClinVar Evidence
            </div>
            {diseaseAssociation.clinvar_evidence.length > 0 ? (
              <div className="space-y-3">
                {diseaseAssociation.clinvar_evidence
                  .slice(0, 3)
                  .map((evidence) => (
                    <div
                      key={`${evidence.disease_name}-${evidence.variation_id ?? ""}`}
                    >
                      <div className="text-sm font-medium text-foreground">
                        {evidence.disease_name}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {evidence.clinical_significance ??
                          "Unknown significance"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {evidence.review_status ?? "Unknown review status"}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-xs leading-relaxed text-muted-foreground">
                No exact curated variant-disease match was found in the local
                ClinVar disease lookup.
              </div>
            )}
          </section>

          <section className="rounded-md border border-border/50 bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              ML Disease Ranking
            </div>
            {topRanking.length > 0 ? (
              <div className="space-y-3">
                {topRanking.map((ranking) => (
                  <div key={ranking.disease_name}>
                    <div className="mb-1 flex justify-between gap-3 text-xs">
                      <span className="truncate text-foreground">
                        {ranking.disease_name}
                      </span>
                      <span className="text-muted-foreground">
                        {(ranking.association_score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-elevated">
                      <div
                        className="h-1.5 rounded-full bg-primary/80"
                        style={{
                          width: `${Math.min(99, ranking.association_score * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs leading-relaxed text-muted-foreground">
                No usable ML disease ranking was returned. Missing evidence is
                not converted into a prediction.
              </div>
            )}
          </section>
        </div>
      ) : null}

      {diseaseAssociation.warnings.length > 0 && (
        <div className="mt-4 rounded-md bg-amber-500/10 p-3 text-xs text-amber-700">
          <div className="mb-1 flex items-center gap-1 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Evidence warnings
          </div>
          <ul className="space-y-1">
            {diseaseAssociation.warnings.slice(0, 4).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 text-xs text-muted-foreground/80">
        Variant key: {result.variant_key}
      </div>
    </div>
  );
}
