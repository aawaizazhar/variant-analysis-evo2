"use client";

import {
  fetchGeneDetails,
  fetchGeneSequence as apiFetchGeneSequence,
  fetchClinvarVariants as apiFetchClinvarVariants,
  type GeneBounds,
  type GeneDetailsFromSearch,
  type GeneFromSearch,
  type ClinvarVariant,
  type ClinvarFetchResult,
  type VariantAnalysisResult,
} from "~/utils/genome-api";
import { Button } from "./ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GeneInformation } from "./gene-information";
import { GeneSequence } from "./gene-sequence";
import KnownVariants from "./known-variants";
import { VariantComparisonModal } from "./variant-comparison-modal";
import VariantAnalysis, {
  type VariantAnalysisHandle,
} from "./variant-analysis";
import { Skeleton } from "./ui/skeleton";
import { type PlanType } from "~/lib/plans";

const GeneViewerSkeleton = () => (
  <div className="space-y-6">
    <Skeleton className="h-8 w-40" />
    <Skeleton className="h-40 w-full" />
    <Skeleton className="h-72 w-full" />
    <Skeleton className="h-64 w-full" />
    <Skeleton className="h-48 w-full" />
  </div>
);

export default function GeneViewer({
  gene,
  genomeId,
  planType,
  onClose,
  analysisCache,
  onAnalysisComplete,
}: {
  gene: GeneFromSearch;
  genomeId: string;
  planType: PlanType;
  onClose: () => void;
  analysisCache: Map<string, ClinvarVariant["analysisResult"]>;
  onAnalysisComplete: (clinvarId: string, result: ClinvarVariant["analysisResult"]) => void;
}) {
  const [geneSequence, setGeneSequence] = useState("");
  const [geneDetail, setGeneDetail] = useState<GeneDetailsFromSearch | null>(
    null,
  );
  const [geneBounds, setGeneBounds] = useState<GeneBounds | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [sequenceError, setSequenceError] = useState<string | null>(null);

  const [startPosition, setStartPosition] = useState<string>("");
  const [endPosition, setEndPosition] = useState<string>("");
  const [isLoadingSequence, setIsLoadingSequence] = useState(false);

  const [clinvarVariants, setClinvarVariants] = useState<ClinvarVariant[]>([]);
  const [isLoadingClinvar, setIsLoadingClinvar] = useState(false);
  const [clinvarError, setClinvarError] = useState<string | null>(null);
  const [clinvarTotalCount, setClinvarTotalCount] = useState(0);
  const [clinvarHasMore, setClinvarHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [actualRange, setActualRange] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const [comparisonVariant, setComparisonVariant] =
    useState<ClinvarVariant | null>(null);

  const [activeSequencePosition, setActiveSequencePosition] = useState<
    number | null
  >(null);
  const [activeReferenceNucleotide, setActiveReferenceNucleotide] = useState<
    string | null
  >(null);

  const variantAnalysisRef = useRef<VariantAnalysisHandle>(null);

  const updateClinvarVariant = (
    clinvar_id: string,
    updateVariant: ClinvarVariant,
  ) => {
    setClinvarVariants((currentVariants) =>
      currentVariants.map((v) =>
        v.clinvar_id == clinvar_id ? updateVariant : v,
      ),
    );

    // Persist completed analysis results to the parent cache
    if (updateVariant.analysisResult && !updateVariant.isAnalyzing) {
      onAnalysisComplete(clinvar_id, updateVariant.analysisResult);
    }
  };

  const fetchGeneSequence = useCallback(
    async (start: number, end: number) => {
      try {
        setIsLoadingSequence(true);
        setSequenceError(null);

        const {
          sequence,
          actualRange: fetchedRange,
          error: apiError,
        } = await apiFetchGeneSequence(gene.chrom, start, end, genomeId);

        setGeneSequence(sequence);
        setActualRange(fetchedRange);

        if (apiError) {
          setSequenceError(apiError);
        }
      } catch (err) {
        setSequenceError("Failed to load sequence data");
      } finally {
        setIsLoadingSequence(false);
      }
    },
    [gene.chrom, genomeId],
  );

  const initializeGeneData = useCallback(async () => {
    setIsLoading(true);
    setViewerError(null);
    setSequenceError(null);

    if (!gene.gene_id) {
      setViewerError("Gene ID is missing, cannot fetch details");
      setIsLoading(false);
      return;
    }

    try {
      const {
        geneDetails: fetchedDetail,
        geneBounds: fetchedGeneBounds,
        initialRange: fetchedRange,
      } = await fetchGeneDetails(gene.gene_id);

      setGeneDetail(fetchedDetail);
      setGeneBounds(fetchedGeneBounds);

      if (fetchedRange) {
        setStartPosition(String(fetchedRange.start));
        setEndPosition(String(fetchedRange.end));
        await fetchGeneSequence(fetchedRange.start, fetchedRange.end);
      }
    } catch {
      setViewerError("Failed to load gene information. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [gene, fetchGeneSequence]);

  useEffect(() => {
    void initializeGeneData();
  }, [initializeGeneData]);

  const handleSequenceClick = useCallback(
    (position: number, nucleotide: string) => {
      setActiveSequencePosition(position);
      setActiveReferenceNucleotide(nucleotide);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (variantAnalysisRef.current) {
        variantAnalysisRef.current.focusAlternativeInput();
      }
    },
    [],
  );

  const handleLoadSequence = useCallback(() => {
    const start = parseInt(startPosition);
    const end = parseInt(endPosition);
    let validationError: string | null = null;

    if (isNaN(start) || isNaN(end)) {
      validationError = "Please enter valid start and end positions";
    } else if (start >= end) {
      validationError = "Start position must be less than end position";
    } else if (geneBounds) {
      const minBound = Math.min(geneBounds.min, geneBounds.max);
      const maxBound = Math.max(geneBounds.min, geneBounds.max);
      if (start < minBound) {
        validationError = `Start position (${start.toLocaleString()}) is below the minimum value (${minBound.toLocaleString()})`;
      } else if (end > maxBound) {
        validationError = `End position (${end.toLocaleString()}) exceeds the maximum value (${maxBound.toLocaleString()})`;
      }

      if (end - start > 10000) {
        validationError = `Selected range exceeds maximum view range of 10.000 bp.`;
      }
    }

    if (validationError) {
      setSequenceError(validationError);
      return;
    }

    setSequenceError(null);
    void fetchGeneSequence(start, end);
  }, [startPosition, endPosition, fetchGeneSequence, geneBounds]);

  const fetchClinvarVariants = async (append = false) => {
    if (!gene.chrom || !geneBounds) return;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingClinvar(true);
      setClinvarVariants([]);
    }
    setClinvarError(null);

    try {
      const retstart = append ? clinvarVariants.length : 0;
      const result: ClinvarFetchResult = await apiFetchClinvarVariants(
        gene.chrom,
        geneBounds,
        genomeId,
        retstart,
      );

      if (append) {
        setClinvarVariants((prev) => [...prev, ...result.variants]);
      } else {
        // Re-apply any cached analysis results to freshly-fetched variants
        const variantsWithCache = result.variants.map((v) => {
          const cached = analysisCache.get(v.clinvar_id);
          return cached
            ? {
                ...v,
                analysisResult: cached,
                evo2Result: toLegacyEvo2Result(cached),
              }
            : v;
        });
        setClinvarVariants(variantsWithCache);
      }

      setClinvarTotalCount(result.totalCount);
      setClinvarHasMore(result.hasMore);
      console.log(
        `Loaded ${result.variants.length} variants. Total: ${result.totalCount}`,
      );
    } catch (error) {
      setClinvarError("Failed to fetch ClinVar variants");
      if (!append) {
        setClinvarVariants([]);
      }
    } finally {
      setIsLoadingClinvar(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (geneBounds) {
      void fetchClinvarVariants();
    }
  }, [geneBounds]);

  const showComparison = (variant: ClinvarVariant) => {
    if (variant.evo2Result) {
      setComparisonVariant(variant);
    }
  };

  if (isLoading) {
    return <GeneViewerSkeleton />;
  }

  if (viewerError) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-400">
        <div className="mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span>{viewerError}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={initializeGeneData}>
            Try again
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Back to results
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="text-foreground hover:bg-muted cursor-pointer"
        onClick={onClose}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to results
      </Button>

      <VariantAnalysis
        ref={variantAnalysisRef}
        gene={gene}
        genomeId={genomeId}
        planType={planType}
        chromosome={gene.chrom}
        clinvarVariants={clinvarVariants}
        referenceSequence={activeReferenceNucleotide}
        sequencePosition={activeSequencePosition}
        geneBounds={geneBounds}
      />

      <KnownVariants
        refreshVariants={() => fetchClinvarVariants(false)}
        loadMoreVariants={() => fetchClinvarVariants(true)}
        showComparison={showComparison}
        updateClinvarVariant={updateClinvarVariant}
        clinvarVariants={clinvarVariants}
        isLoadingClinvar={isLoadingClinvar}
        isLoadingMore={isLoadingMore}
        clinvarError={clinvarError}
        clinvarTotalCount={clinvarTotalCount}
        clinvarHasMore={clinvarHasMore}
        genomeId={genomeId}
        planType={planType}
        gene={gene}
      />

      <GeneSequence
        geneBounds={geneBounds}
        geneDetail={geneDetail}
        startPosition={startPosition}
        endPosition={endPosition}
        onStartPositionChange={setStartPosition}
        onEndPositionChange={setEndPosition}
        sequenceData={geneSequence}
        sequenceRange={actualRange}
        isLoading={isLoadingSequence}
        error={sequenceError}
        onSequenceLoadRequest={handleLoadSequence}
        onSequenceClick={handleSequenceClick}
        maxViewRange={10000}
      />

      <GeneInformation
        gene={gene}
        geneDetail={geneDetail}
        geneBounds={geneBounds}
      />

      <VariantComparisonModal
        comparisonVariant={comparisonVariant}
        genomeId={genomeId}
        chromosome={gene.chrom}
        geneSymbol={gene.symbol}
        onClose={() => setComparisonVariant(null)}
      />
    </div>
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
