import type { ClinvarVariant } from "~/utils/genome-api";
import { Button } from "./ui/button";
import { Check, ExternalLink, Shield, X } from "lucide-react";
import {
  getClassificationColorClasses,
  getNucleotideColorClass,
} from "~/utils/coloring-utils";
import { DiseaseAssociationPanel } from "./disease-association-panel";

export function VariantComparisonModal({
  comparisonVariant,
  onClose,
}: {
  comparisonVariant: ClinvarVariant | null;
  genomeId: string;
  chromosome: string;
  geneSymbol?: string;
  onClose: () => void;
}) {
  if (!comparisonVariant?.evo2Result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-background border-border max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border shadow-2xl">
        {/* Modal header */}
        <div className="border-border/40 border-b p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground text-lg font-medium">
              DNAAnalyzer Comparison
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:bg-secondary/40 hover:text-foreground h-7 w-7 cursor-pointer p-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Modal content */}
        <div className="p-5">
          {comparisonVariant.evo2Result && (
            <div className="space-y-6">
              <div className="border-border/40 bg-secondary/20 rounded-md border p-4">
                <h4 className="text-foreground mb-3 text-sm font-medium">
                  Variant Information
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="space-y-2">
                      <div className="flex">
                        <span className="text-muted-foreground w-28 text-xs">
                          Position:
                        </span>
                        <span className="text-foreground text-xs">
                          {comparisonVariant.location}
                        </span>
                      </div>
                      <div className="flex">
                        <span className="text-muted-foreground w-28 text-xs">
                          Type:
                        </span>
                        <span className="text-foreground text-xs">
                          {comparisonVariant.variation_type}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="space-y-2">
                      <div className="flex">
                        <span className="text-muted-foreground w-28 text-xs">
                          Variant:
                        </span>
                        <span className="text-foreground font-mono text-xs">
                          {(() => {
                            const match = /(\w)>(\w)/.exec(
                              comparisonVariant.title,
                            );
                            if (match && match.length === 3) {
                              const ref = match[1];
                              const alt = match[2];
                              return (
                                <>
                                  <span
                                    className={getNucleotideColorClass(ref!)}
                                  >
                                    {ref}
                                  </span>
                                  <span>{">"}</span>
                                  <span
                                    className={getNucleotideColorClass(alt!)}
                                  >
                                    {alt}
                                  </span>
                                </>
                              );
                            }
                            return comparisonVariant.title;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-muted-foreground w-28 text-xs">
                          ClinVar ID:
                        </span>
                        <a
                          href={`https://www.ncbi.nlm.nih.gov/clinvar/variation/${comparisonVariant.clinvar_id}`}
                          className="text-phosphor text-xs hover:underline"
                          target="_blank"
                        >
                          {comparisonVariant.clinvar_id}
                        </a>
                        <ExternalLink className="text-phosphor ml-1 inline-block h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Variant results */}
              <div>
                <h4 className="text-foreground mb-3 text-sm font-medium">
                  Analysis Comparison
                </h4>
                <div className="bg-background border-border/40 rounded-md border p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* ClinVar Assesment */}
                    <div className="bg-secondary/40 rounded-md p-4">
                      <h5 className="text-foreground mb-2 flex items-center gap-2 text-xs font-medium">
                        <span className="bg-foreground/10 flex h-5 w-5 items-center justify-center rounded-full">
                          <span className="bg-foreground h-3 w-3 rounded-full"></span>
                        </span>
                        ClinVar Assessment
                      </h5>
                      <div className="mt-2">
                        <div
                          className={`w-fit rounded-md px-2 py-1 text-xs font-normal ${getClassificationColorClasses(comparisonVariant.classification)}`}
                        >
                          {comparisonVariant.classification ||
                            "Unknown significance"}
                        </div>
                      </div>
                    </div>

                    {/* Evo2 Prediction */}
                    <div className="bg-secondary/40 rounded-md p-4">
                      <h5 className="text-foreground mb-2 flex items-center gap-2 text-xs font-medium">
                        <span className="bg-phosphor/10 flex h-5 w-5 items-center justify-center rounded-full">
                          <span className="bg-phosphor h-3 w-3 rounded-full"></span>
                        </span>
                        Evo2 Computational Prediction
                      </h5>
                      <div className="mt-2">
                        <div
                          className={`flex w-fit items-center gap-1 rounded-md px-2 py-1 text-xs font-normal ${getClassificationColorClasses(comparisonVariant.evo2Result.prediction)}`}
                        >
                          <Shield className="h-3 w-3" />
                          {comparisonVariant.evo2Result.prediction}
                        </div>
                      </div>
                      {/* Delta score */}
                      <div className="mt-3">
                        <div className="text-muted-foreground mb-1 text-xs">
                          Delta Likelihood Score:
                        </div>
                        <div className="text-foreground text-sm font-medium">
                          {comparisonVariant.evo2Result.delta_score.toFixed(6)}
                        </div>
                        <div className="text-muted-foreground/60 text-xs">
                          {comparisonVariant.evo2Result.delta_score < 0
                            ? "Lower sequence likelihood; not confirmed loss of function"
                            : "Higher sequence likelihood; not confirmed gain of function"}
                        </div>
                      </div>
                      {/* Confidence bar */}
                      <div className="mt-3">
                        <div className="text-muted-foreground mb-1 text-xs">
                          Model score (uncalibrated):
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">
                          {comparisonVariant.evo2Result.classification_confidence.toFixed(
                            3,
                          )}
                        </div>
                        <p className="text-muted-foreground mt-2 text-xs">
                          This is a computational prediction, not a clinical
                          classification or disease-risk probability.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Assesment Agreement */}
                  <div className="bg-secondary/10 mt-4 rounded-md p-3 text-xs leading-relaxed">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full ${comparisonVariant.classification.toLowerCase() === comparisonVariant.evo2Result.prediction.toLowerCase() ? "bg-phosphor/20" : "bg-amber-500/20"}`}
                      >
                        {comparisonVariant.classification.toLowerCase() ===
                        comparisonVariant.evo2Result.prediction.toLowerCase() ? (
                          <Check className="text-phosphor h-3 w-3" />
                        ) : (
                          <span className="flex h-3 w-3 items-center justify-center text-amber-500">
                            <p>!</p>
                          </span>
                        )}
                      </span>
                      <span className="text-foreground font-medium">
                        {comparisonVariant.classification.toLowerCase() ===
                        comparisonVariant.evo2Result.prediction.toLowerCase()
                          ? "Evo2 prediction agrees with ClinVar classification"
                          : "Evo2 prediction differs from ClinVar classification"}
                      </span>
                    </div>
                  </div>

                  {comparisonVariant.analysisResult ? (
                    <DiseaseAssociationPanel
                      result={comparisonVariant.analysisResult}
                    />
                  ) : (
                    <div className="mt-5 rounded-md bg-amber-500/10 p-3 text-xs text-amber-700">
                      Disease association evidence is unavailable for this
                      cached comparison. Re-run the selected SNV to generate the
                      full interpretation.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="border-border/40 bg-secondary/20 flex justify-end border-t p-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-border/40 hover:bg-secondary/40 cursor-pointer"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
