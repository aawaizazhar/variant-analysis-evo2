"use client";

import {
  analyzeVariantPipelineWithAPI,
  type ClinvarVariant,
  type GeneBounds,
  type GeneFromSearch,
  type VariantAnalysisResult,
} from "~/utils/genome-api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  getClassificationColorClasses,
  getNucleotideColorClass,
} from "~/utils/coloring-utils";
import { Button } from "./ui/button";
import { Zap } from "lucide-react";
import { formatPlanName, getPlanLimits, type PlanType } from "~/lib/plans";
import { DiseaseAssociationPanel } from "./disease-association-panel";

export interface VariantAnalysisHandle {
  focusAlternativeInput: () => void;
}

interface VariantAnalysisProps {
  gene: GeneFromSearch;
  genomeId: string;
  planType: PlanType;
  chromosome: string;
  clinvarVariants: Array<ClinvarVariant>;
  referenceSequence: string | null;
  sequencePosition: number | null;
  geneBounds: GeneBounds | null;
}

const VariantAnalysis = forwardRef<VariantAnalysisHandle, VariantAnalysisProps>(
  (
    {
      gene,
      genomeId,
      planType,
      chromosome,
      clinvarVariants = [],
      referenceSequence,
      sequencePosition,
      geneBounds,
    }: VariantAnalysisProps,
    ref,
  ) => {
    const [variantPosition, setVariantPosition] = useState<string>(
      geneBounds?.min?.toString() ?? "",
    );
    const [variantReference, setVariantReference] = useState("");
    const [variantAlternative, setVariantAlternative] = useState("");
    const [variantResult, setVariantResult] =
      useState<VariantAnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [variantError, setVariantError] = useState<string | null>(null);
    const alternativeInputRef = useRef<HTMLInputElement>(null);
    const planLimits = getPlanLimits(planType);

    useImperativeHandle(ref, () => ({
      focusAlternativeInput: () => {
        if (alternativeInputRef.current) {
          alternativeInputRef.current.focus();
        }
      },
    }));

    useEffect(() => {
      if (sequencePosition && referenceSequence) {
        setVariantPosition(String(sequencePosition));
        setVariantReference(referenceSequence);
      }
    }, [sequencePosition, referenceSequence]);

    const handlePositionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setVariantPosition(e.target.value);
      setVariantReference("");
    };

    const handleVariantSubmit = async (
      pos: string,
      alt: string,
      expectedReference?: string,
      metadata?: {
        clinvarVariationId?: string;
        source?: string;
      },
    ) => {
      const position = parseInt(pos);
      const normalizedAlt = alt.toUpperCase();
      const normalizedReference = (expectedReference ?? variantReference)
        .trim()
        .toUpperCase();

      if (isNaN(position)) {
        setVariantError("Please enter a valid position number");
        return;
      }

      const validNucleotides = /^[ATGC]$/;
      if (!validNucleotides.test(normalizedAlt)) {
        setVariantError("Nucleotides must be A, C, G or T");
        return;
      }

      if (!normalizedReference) {
        setVariantError(
          "Reference base is required. Select a nucleotide from the sequence or choose a known SNV.",
        );
        return;
      }

      if (normalizedReference && normalizedAlt === normalizedReference) {
        setVariantError(
          `Alternative base must be different from the reference base (${normalizedReference}).`,
        );
        return;
      }

      setIsAnalyzing(true);
      setVariantError(null);

      try {
        const data = await analyzeVariantPipelineWithAPI({
          variant_position: position,
          reference: normalizedReference,
          alternative: normalizedAlt,
          genome: genomeId,
          chromosome,
          gene: gene?.symbol,
          gene_symbol: gene?.symbol,
          clinvar_variation_id: metadata?.clinvarVariationId,
          source: metadata?.source ?? "manual",
        });
        setVariantResult(data);
      } catch (err) {
        setVariantError(
          err instanceof Error ? err.message : "Failed to analyze variant",
        );
      } finally {
        setIsAnalyzing(false);
      }
    };

    return (
      <Card className="border-border/50 bg-card gap-0 py-0 shadow-sm">
        <CardHeader className="pt-4 pb-2">
          <CardTitle className="text-muted-foreground text-sm font-normal">
            DNAAnalyzer
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-muted-foreground mb-4 text-xs">
            Predict the impact of genetic variants using the Evo2 deep learning
            model.
            <span className="mt-1 block">
              {formatPlanName(planType)} plan:{" "}
              {planLimits.dailyPredictions.toLocaleString()} predictions/day.
            </span>
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">
                Position
              </label>
              <Input
                value={variantPosition}
                onChange={handlePositionChange}
                className="border-border/50 h-8 w-32 text-xs"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">
                Alternative (variant)
              </label>
              <Input
                ref={alternativeInputRef}
                value={variantAlternative}
                onChange={(e) =>
                  setVariantAlternative(e.target.value.toUpperCase())
                }
                className="border-border/50 h-8 w-32 text-xs"
                placeholder="e.g., T"
                maxLength={1}
              />
            </div>
            {variantReference && (
              <div className="text-foreground mb-2 flex items-center gap-2 text-xs">
                <span>Substitution</span>
                <span
                  className={`font-medium ${getNucleotideColorClass(variantReference)}`}
                >
                  {variantReference}
                </span>
                <span>→</span>
                <span
                  className={`font-medium ${getNucleotideColorClass(variantAlternative)}`}
                >
                  {variantAlternative ? variantAlternative : "?"}
                </span>
              </div>
            )}
            <Button
              disabled={isAnalyzing || !variantPosition || !variantAlternative}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 cursor-pointer text-xs"
              onClick={() =>
                void handleVariantSubmit(
                  variantPosition.replaceAll(",", ""),
                  variantAlternative,
                )
              }
            >
              {isAnalyzing ? (
                <>
                  <span className="border-primary-foreground mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent align-middle"></span>
                  Analyzing...
                </>
              ) : (
                "Analyze variant"
              )}
            </Button>
          </div>

          {variantPosition &&
            clinvarVariants
              .filter(
                (variant) =>
                  variant?.variation_type
                    ?.toLowerCase()
                    .includes("single nucleotide") &&
                  parseInt(variant?.location?.replaceAll(",", "")) ===
                    parseInt(variantPosition.replaceAll(",", "")),
              )
              .map((matchedVariant) => {
                const refAltMatch = /(\w)>(\w)/.exec(matchedVariant.title);

                let ref = null;
                let alt = null;
                if (refAltMatch && refAltMatch.length === 3) {
                  ref = refAltMatch[1];
                  alt = refAltMatch[2];
                }

                if (!ref || !alt) return null;

                return (
                  <div
                    key={matchedVariant.clinvar_id}
                    className="border-border/50 bg-muted/50 mt-4 rounded-md border p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-foreground text-sm font-medium">
                        Known Variant Detected
                      </h4>
                      <span className="text-muted-foreground text-xs">
                        Position: {matchedVariant.location}
                      </span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-muted-foreground mb-1 text-xs font-medium">
                          Variant Details
                        </div>
                        <div className="text-sm">{matchedVariant.title}</div>
                        <div className="mt-2 text-sm">
                          {gene?.symbol} {variantPosition}{" "}
                          <span className="font-mono">
                            <span className={getNucleotideColorClass(ref)}>
                              {ref}
                            </span>
                            <span>{">"}</span>
                            <span className={getNucleotideColorClass(alt)}>
                              {alt}
                            </span>
                          </span>
                        </div>
                        <div className="text-muted-foreground mt-2 text-xs">
                          ClinVar classification
                          <span
                            className={`ml-1 rounded-sm px-2 py-0.5 ${getClassificationColorClasses(matchedVariant.classification)}`}
                          >
                            {matchedVariant.classification || "Unknown"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-end">
                        <Button
                          disabled={isAnalyzing}
                          variant="outline"
                          size="sm"
                          className="border-border/50 bg-card text-foreground hover:bg-muted h-7 cursor-pointer text-xs"
                          onClick={() => {
                            setVariantAlternative(alt);
                            setVariantReference(ref);
                            void handleVariantSubmit(
                              variantPosition.replaceAll(",", ""),
                              alt,
                              ref,
                              {
                                clinvarVariationId: matchedVariant.clinvar_id,
                                source: "clinvar",
                              },
                            );
                          }}
                        >
                          {isAnalyzing ? (
                            <>
                              <span className="border-muted-foreground/30 border-t-primary mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 align-middle"></span>
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Zap className="mr-1 inline-block h-3 w-3" />
                              Analyze this Variant
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })[0]}
          {variantError && (
            <div className="mt-4 rounded-md bg-red-500/10 p-3 text-xs text-red-400">
              {variantError}
            </div>
          )}
          {variantResult && (
            <div className="border-border/80 bg-card mt-6 overflow-hidden rounded-2xl border p-4 shadow-sm sm:p-6">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.16em] uppercase">
                    Evo2 analysis
                  </p>
                  <h4 className="text-foreground mt-1.5 text-lg font-semibold tracking-tight">
                    Variant interpretation
                  </h4>
                </div>
                <span className="border-border text-muted-foreground rounded-full border px-2.5 py-1 text-[11px]">
                  Computational prediction
                </span>
              </header>

              <div className="bg-muted/40 mt-5 grid gap-5 rounded-xl p-4 sm:grid-cols-2 sm:gap-6 sm:p-5">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">
                    Analyzed variant
                  </p>
                  <p className="text-foreground mt-2 text-base font-semibold break-words">
                    {variantResult.gene ?? gene?.symbol ?? "Gene not supplied"}
                  </p>
                  <p className="text-muted-foreground mt-1 font-mono text-xs leading-relaxed break-all">
                    chr{variantResult.normalized_variant.chrom}:
                    {variantResult.normalized_variant.pos.toLocaleString(
                      "en-US",
                    )}
                    <span className="text-foreground ml-2 font-medium">
                      {variantResult.normalized_variant.ref}
                      {">"}
                      {variantResult.normalized_variant.alt}
                    </span>
                  </p>
                </div>
                <div className="border-border/70 border-t pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
                  <p className="text-muted-foreground text-xs">
                    Evo2 prediction
                  </p>
                  <p className="text-foreground mt-2 text-lg font-semibold tracking-tight">
                    {variantResult.evo2.classification}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Requires clinical evidence for interpretation
                  </p>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-2">
                <div>
                  <dt className="text-muted-foreground text-[11px] font-medium">
                    Delta likelihood
                  </dt>
                  <dd className="text-foreground mt-1.5 font-mono text-sm break-all tabular-nums">
                    {variantResult.evo2.delta_score?.toFixed(6) ??
                      "Unavailable"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-[11px] font-medium">
                    Model score{" "}
                    <span className="font-normal">/ uncalibrated</span>
                  </dt>
                  <dd className="text-foreground mt-1.5 font-mono text-sm tabular-nums">
                    {variantResult.evo2.confidence?.toFixed(3) ?? "Unavailable"}
                  </dd>
                </div>
              </dl>
              <p className="text-muted-foreground mt-3 max-w-[72ch] text-[11px] leading-relaxed">
                Negative delta scores indicate lower sequence likelihood, not
                confirmed loss of function. Model scores are not disease-risk
                probabilities.
              </p>

              <DiseaseAssociationPanel result={variantResult} />
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
);

VariantAnalysis.displayName = "VariantAnalysis";

export default VariantAnalysis;
