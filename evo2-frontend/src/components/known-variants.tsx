"use client";

import {
  analyzeVariantPipelineWithAPI,
  type ClinvarVariant,
  type GeneFromSearch,
  type VariantAnalysisResult,
} from "~/utils/genome-api";
import { formatPlanName, type PlanType } from "~/lib/plans";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  BarChart2,
  ExternalLink,
  RefreshCw,
  Search,
  Shield,
  Zap,
} from "lucide-react";
import { getClassificationColorClasses } from "~/utils/coloring-utils";

export default function KnownVariants({
  refreshVariants,
  loadMoreVariants,
  showComparison,
  updateClinvarVariant,
  clinvarVariants,
  isLoadingClinvar,
  isLoadingMore,
  clinvarError,
  clinvarTotalCount,
  clinvarHasMore,
  genomeId,
  planType,
  gene,
}: {
  refreshVariants: () => void;
  loadMoreVariants: () => void;
  showComparison: (variant: ClinvarVariant) => void;
  updateClinvarVariant: (id: string, newVariant: ClinvarVariant) => void;
  clinvarVariants: ClinvarVariant[];
  isLoadingClinvar: boolean;
  isLoadingMore: boolean;
  clinvarError: string | null;
  clinvarTotalCount: number;
  clinvarHasMore: boolean;
  genomeId: string;
  planType: PlanType;
  gene: GeneFromSearch;
}) {
  const analyzeVariant = async (variant: ClinvarVariant) => {
    let variantDetails: {
      position: number | null;
      reference: string;
      alternative: string;
    } | null = null;
    const position = variant.location
      ? parseInt(variant.location.replaceAll(",", ""))
      : null;

    const refAltMatch = /([ACGT])>([ACGT])/i.exec(variant.title);

    const reference = refAltMatch?.[1]?.toUpperCase();
    const alternative = refAltMatch?.[2]?.toUpperCase();

    if (reference && alternative) {
      variantDetails = {
        position,
        reference,
        alternative,
      };
    }

    if (
      !variantDetails?.position ||
      !variantDetails.reference ||
      !variantDetails.alternative
    ) {
      updateClinvarVariant(variant.clinvar_id, {
        ...variant,
        isAnalyzing: false,
        evo2Error:
          "This ClinVar row could not be converted into a single-nucleotide Evo2 request.",
      });
      return;
    }

    if (
      variantDetails.reference.toUpperCase() ===
      variantDetails.alternative.toUpperCase()
    ) {
      updateClinvarVariant(variant.clinvar_id, {
        ...variant,
        isAnalyzing: false,
        evo2Error: `Alternative base must be different from the reference base (${variantDetails.reference.toUpperCase()}).`,
      });
      return;
    }

    updateClinvarVariant(variant.clinvar_id, {
      ...variant,
      isAnalyzing: true,
      evo2Error: undefined,
    });

    try {
      const data = await analyzeVariantPipelineWithAPI({
        variant_position: variantDetails.position,
        reference: variantDetails.reference,
        alternative: variantDetails.alternative,
        genome: genomeId,
        chromosome: gene.chrom,
        gene: gene.symbol,
        gene_symbol: gene.symbol,
        clinvar_variation_id: variant.clinvar_id,
        source: "clinvar",
      });

      const updatedVariant: ClinvarVariant = {
        ...variant,
        isAnalyzing: false,
        evo2Error: undefined,
        evo2Result: toLegacyEvo2Result(data),
        analysisResult: data,
      };

      updateClinvarVariant(variant.clinvar_id, updatedVariant);

      showComparison(updatedVariant);
    } catch (error) {
      updateClinvarVariant(variant.clinvar_id, {
        ...variant,
        isAnalyzing: false,
        evo2Error: error instanceof Error ? error.message : "Analysis failed",
      });
    }
  };
  const filteredVariants = clinvarVariants.filter((variant) =>
    variant.variation_type.toLowerCase().includes("single nucleotide")
  );

  return (
    <Card className="gap-0 border-border/50 bg-card py-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pt-4 pb-2">
        <div className="flex flex-col">
          <CardTitle className="text-sm font-normal text-muted-foreground">
            Known Variants in Gene from ClinVar
          </CardTitle>
          {clinvarTotalCount > 0 && (
            <p className="mt-1 text-xs text-muted-foreground/70">
              Showing {filteredVariants.length} SNVs (from {clinvarVariants.length} loaded of {clinvarTotalCount.toLocaleString()} variants)
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground/70">
            Evo2 analysis uses your {formatPlanName(planType)} plan limits.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshVariants}
          disabled={isLoadingClinvar}
          className="h-7 cursor-pointer text-xs text-muted-foreground hover:bg-muted"
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="pb-4">
        {clinvarError && (
          <div className="mb-4 rounded-md bg-red-500/10 p-3 text-xs text-red-400">
            {clinvarError}
          </div>
        )}

        {isLoadingClinvar ? (
          <div className="flex justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-phosphor"></div>
          </div>
        ) : filteredVariants.length > 0 ? (
          <div className="h-96 max-h-96 overflow-y-scroll rounded-md border border-border/50">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-muted/80 hover:bg-muted/80">
                  <TableHead className="py-2 text-xs font-medium text-muted-foreground">
                    Variant
                  </TableHead>
                  <TableHead className="py-2 text-xs font-medium text-muted-foreground">
                    Type
                  </TableHead>
                  <TableHead className="py-2 text-xs font-medium text-muted-foreground">
                    Clinical Significance
                  </TableHead>
                  <TableHead className="py-2 text-xs font-medium text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVariants.map((variant) => (
                  <TableRow
                    key={variant.clinvar_id}
                    className="border-b border-border/40"
                  >
                    <TableCell className="py-2">
                      <div className="text-xs font-medium text-foreground">
                        {variant.title}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <p>Location: {variant.location}</p>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-6 cursor-pointer px-0 text-xs text-phosphor hover:text-phosphor/80"
                          onClick={() =>
                            window.open(
                              `https://www.ncbi.nlm.nih.gov/clinvar/variation/${variant.clinvar_id}`,
                              "_blank",
                            )
                          }
                        >
                          View in ClinVar
                          <ExternalLink className="ml-1 inline-block h-2 w-2" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-xs">
                      {variant.variation_type}
                    </TableCell>
                    <TableCell className="py-2 text-xs">
                      <div
                        className={`w-fit rounded-md px-2 py-1 text-center font-normal ${getClassificationColorClasses(variant.classification)}`}
                      >
                        {variant.classification || "Unknown"}
                      </div>
                      {variant.evo2Result && (
                        <div className="mt-2">
                          <div
                            className={`flex w-fit items-center gap-1 rounded-md px-2 py-1 text-center ${getClassificationColorClasses(variant.evo2Result.prediction)}`}
                          >
                            <Shield className="h-3 w-3" />
                            <span>Evo2: {variant.evo2Result.prediction}</span>
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-xs">
                      <div className="flex flex-col items-end gap-1">
                        {!variant.evo2Result ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 cursor-pointer border-border/50 bg-card px-3 text-xs text-foreground hover:bg-muted"
                            disabled={variant.isAnalyzing}
                            onClick={() => analyzeVariant(variant)}
                          >
                            {variant.isAnalyzing ? (
                              <>
                                <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-phosphor"></span>
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Zap className="mr-1 inline-block h-3 w-3" />
                                Analyze with Evo2
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 cursor-pointer border-phosphor/30 bg-phosphor/10 px-3 text-xs text-phosphor hover:bg-phosphor/20"
                            onClick={() => showComparison(variant)}
                          >
                            <BarChart2 className="mr-1 inline-block h-3 w-3" />
                            Compare Results
                          </Button>
                        )}
                        {variant.evo2Error && (
                          <p className="max-w-56 text-right text-[11px] leading-snug text-red-400">
                            {variant.evo2Error}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {clinvarHasMore && (
              <div className="mt-3 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMoreVariants}
                  disabled={isLoadingMore}
                  className="h-8 cursor-pointer border-border/50 bg-card px-4 text-xs text-foreground hover:bg-muted"
                >
                  {isLoadingMore ? (
                    <>
                      <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-phosphor"></span>
                      Loading more...
                    </>
                  ) : (
                    `Load More (${(clinvarTotalCount - clinvarVariants.length).toLocaleString()} remaining)`
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-center text-muted-foreground">
            <Search className="mb-4 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm leading-relaxed">
              {clinvarVariants.length > 0 
                ? "No Single Nucleotide Variants found in the loaded variants."
                : "No ClinVar variants found for this gene."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function toLegacyEvo2Result(result: VariantAnalysisResult) {
  return {
    position: result.normalized_variant.pos,
    reference: result.normalized_variant.ref,
    alternative: result.normalized_variant.alt,
    prediction: result.evo2.classification,
    delta_score: result.evo2.delta_score ?? 0,
    classification_confidence: result.evo2.confidence ?? 0,
  };
}
