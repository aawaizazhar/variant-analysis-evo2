import type { SupabaseClient } from "@supabase/supabase-js";

export type Evo2Prediction =
  | "pathogenic"
  | "likely_pathogenic"
  | "uncertain"
  | "likely_benign"
  | "benign";

export type EvidenceLevel =
  | "strong"
  | "conflicting"
  | "possible"
  | "low"
  | "insufficient";

export type VariantPipelineInput = {
  variant_position: number;
  reference: string;
  alternative: string;
  genome: string;
  chromosome: string;
  gene?: string;
  gene_symbol?: string;
  rsid?: string;
  clinvar_variation_id?: string;
  hgvs_g?: string;
  transcript_id?: string;
  source?: string;
};

export type NormalizedVariant = {
  variant_key: string;
  assembly: string;
  gene: string | null;
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  rsid: string | null;
  clinvar_variation_id: string | null;
  hgvs_g: string;
  transcript_id: string | null;
  source: string;
};

export type Evo2Result = {
  prediction: Evo2Prediction;
  classification: string;
  score: number | null;
  confidence: number | null;
  delta_score: number | null;
  cached: boolean;
  raw_prediction?: string | null;
};

export type ClinvarEvidence = {
  disease_name: string;
  disease_id: string | null;
  clinical_significance: string | null;
  sig_group: string | null;
  review_status: string | null;
  review_score: number | null;
  variation_id: string | null;
  rsid: string | null;
  source: string;
};

export type DiseaseModelCandidate = {
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  gene: string;
  disease_name: string;
  review_score: number;
  is_transition: number;
  position_mod_1000: number;
};

export type DiseaseModelRanking = {
  disease_name: string;
  association_score: number;
  source: "custom_ml_model";
};

export type FinalInterpretation = {
  level: EvidenceLevel;
  message: string;
  confidence_explanation: string;
  warning: string;
};

export type DiseaseAssociationStatus =
  | "available"
  | "unsupported_gene"
  | "no_evidence_found"
  | "model_unavailable";

export type DiseaseAssociationResult = {
  status: DiseaseAssociationStatus;
  clinvar_evidence: ClinvarEvidence[];
  disease_model_ranking: DiseaseModelRanking[];
  final_interpretation: FinalInterpretation | null;
  model_version: string | null;
  warnings: string[];
};

export type VariantAnalysisResult = {
  variant_key: string;
  gene: string | null;
  normalized_variant: NormalizedVariant;
  evo2: Evo2Result;
  disease_association: DiseaseAssociationResult;
  clinvar_evidence: ClinvarEvidence[];
  disease_model_ranking: DiseaseModelRanking[];
  final_interpretation: FinalInterpretation | null;
  model_version: string | null;
  warnings: string[];
};

type ModalEvo2Result = {
  prediction?: unknown;
  classification_confidence?: unknown;
  delta_score?: unknown;
  reference?: unknown;
  alternative?: unknown;
};

type ClinvarLookupRow = {
  variant_key?: unknown;
  gene?: unknown;
  chrom?: unknown;
  pos?: unknown;
  ref?: unknown;
  alt?: unknown;
  disease_name?: unknown;
  disease_id?: unknown;
  clinical_significance?: unknown;
  sig_group?: unknown;
  review_status?: unknown;
  review_score?: unknown;
  variation_id?: unknown;
  rsid?: unknown;
  source?: unknown;
};

type DiseaseRankerResponse = {
  ranking?: unknown;
  model_version?: unknown;
  error?: unknown;
  detail?: unknown;
};

const DISEASE_MODEL_VERSION = "snv_disease_ranker_no_evo2";
const MIN_HIGH_DISEASE_SCORE = 0.75;
const MAX_DISPLAY_SCORE = 0.99;

const BAD_DISEASE_NAMES = new Set([
  "",
  "-",
  "na",
  "n/a",
  "nan",
  "none",
  "none provided",
  "not applicable",
  "not provided",
  "not specified",
  "not supplied",
  "unknown",
  "unspecified",
]);

export function isVariantPipelineInput(
  value: unknown,
): value is VariantPipelineInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.variant_position === "number" &&
    Number.isFinite(candidate.variant_position) &&
    typeof candidate.reference === "string" &&
    typeof candidate.alternative === "string" &&
    typeof candidate.genome === "string" &&
    typeof candidate.chromosome === "string" &&
    (candidate.gene === undefined || typeof candidate.gene === "string") &&
    (candidate.gene_symbol === undefined ||
      typeof candidate.gene_symbol === "string") &&
    (candidate.rsid === undefined || typeof candidate.rsid === "string") &&
    (candidate.clinvar_variation_id === undefined ||
      typeof candidate.clinvar_variation_id === "string") &&
    (candidate.hgvs_g === undefined || typeof candidate.hgvs_g === "string") &&
    (candidate.transcript_id === undefined ||
      typeof candidate.transcript_id === "string") &&
    (candidate.source === undefined || typeof candidate.source === "string")
  );
}

export function normalizeVariantInput(
  input: VariantPipelineInput,
): NormalizedVariant {
  const assembly = normalizeAssembly(input.genome);
  const chrom = normalizeChromosome(input.chromosome);
  const ref = input.reference.trim().toUpperCase();
  const alt = input.alternative.trim().toUpperCase();
  const gene = normalizeGeneSymbol(input.gene_symbol ?? input.gene);

  if (!Number.isInteger(input.variant_position) || input.variant_position <= 0) {
    throw new Error("Variant position must be a positive integer.");
  }

  if (!/^[ACGT]$/.test(ref) || !/^[ACGT]$/.test(alt)) {
    throw new Error("Only single nucleotide A, C, G, or T substitutions are supported.");
  }

  if (ref === alt) {
    throw new Error(`Alternative base must be different from the reference base (${ref}).`);
  }

  if (!chrom) {
    throw new Error("Chromosome is required.");
  }

  const variantKey = `${chrom}:${input.variant_position}:${ref}>${alt}`;
  const providedHgvsG = input.hgvs_g?.trim();
  const providedSource = input.source?.trim();
  const hgvsG =
    providedHgvsG && providedHgvsG.length > 0
      ? providedHgvsG
      : `chr${chrom}:g.${input.variant_position}${ref}>${alt}`;

  return {
    variant_key: variantKey,
    assembly,
    gene: gene.length > 0 ? gene : null,
    chrom,
    pos: input.variant_position,
    ref,
    alt,
    rsid: normalizeOptionalText(input.rsid),
    clinvar_variation_id: normalizeOptionalText(input.clinvar_variation_id),
    hgvs_g: hgvsG,
    transcript_id: normalizeOptionalText(input.transcript_id),
    source:
      providedSource && providedSource.length > 0 ? providedSource : "manual",
  };
}

export async function getEvo2ResultWithCache({
  supabase,
  input,
}: {
  supabase: SupabaseClient;
  input: VariantPipelineInput;
}): Promise<{ normalized: NormalizedVariant; evo2: Evo2Result; warnings: string[] }> {
  const warnings: string[] = [];
  const resolvedInput = await resolveClinvarVariantInput(
    supabase,
    input,
    warnings,
  );
  const normalized = normalizeVariantInput(resolvedInput);

  try {
    const evo2 = await readOrRunEvo2Result(supabase, normalized, warnings);
    return { normalized, evo2, warnings };
  } catch (error) {
    if (!shouldRetryClinvarAsReverseComplement(resolvedInput, normalized, error)) {
      throw error;
    }
  }

  const complementedRef = complementBase(normalized.ref);
  const complementedAlt = complementBase(normalized.alt);
  if (!complementedRef || !complementedAlt) {
    throw new Error("Only single nucleotide A, C, G, or T substitutions are supported.");
  }

  warnings.push(
    "ClinVar allele orientation was reverse-complemented for Evo2 analysis.",
  );

  const complemented = normalizeVariantInput({
    ...resolvedInput,
    reference: complementedRef,
    alternative: complementedAlt,
  });
  const evo2 = await readOrRunEvo2Result(supabase, complemented, warnings);

  return { normalized: complemented, evo2, warnings };
}

async function resolveClinvarVariantInput(
  supabase: SupabaseClient,
  input: VariantPipelineInput,
  warnings: string[],
): Promise<VariantPipelineInput> {
  if (!input.clinvar_variation_id) {
    return input;
  }

  const assembly = normalizeAssembly(input.genome);
  const { data, error } = await supabase
    .from("clinvar_disease_lookup")
    .select("chrom,pos,ref,alt,gene,variant_key,variation_id")
    .eq("assembly", assembly)
    .eq("variation_id", input.clinvar_variation_id)
    .limit(1);

  if (error) {
    warnings.push(`ClinVar allele normalization unavailable: ${error.message}`);
    return input;
  }

  const row = Array.isArray(data) ? (data[0] as ClinvarLookupRow | undefined) : undefined;
  const pos = numberOrNull(row?.pos);
  const ref = stringOrNull(row?.ref);
  const alt = stringOrNull(row?.alt);
  const chrom = stringOrNull(row?.chrom);
  const gene = stringOrNull(row?.gene);

  if (!pos || !ref || !alt || !chrom) {
    return input;
  }

  return {
    ...input,
    variant_position: pos,
    reference: ref,
    alternative: alt,
    chromosome: chrom,
    gene: gene ?? input.gene,
    gene_symbol: gene ?? input.gene_symbol,
  };
}

async function readOrRunEvo2Result(
  supabase: SupabaseClient,
  normalized: NormalizedVariant,
  warnings: string[],
) {
  const cached = await readCachedEvo2Result(supabase, normalized, warnings);
  if (cached) {
    return cached;
  }

  const modalResult = await runEvo2Modal(normalized);
  await writeCachedEvo2Result(supabase, normalized, modalResult, warnings);

  return modalResult;
}

function shouldRetryClinvarAsReverseComplement(
  input: VariantPipelineInput,
  normalized: NormalizedVariant,
  error: unknown,
) {
  const source = normalizeOptionalText(input.source)?.toLowerCase();
  const isClinvarInput = source === "clinvar" || !!input.clinvar_variation_id;
  const complementedRef = complementBase(normalized.ref);
  const complementedAlt = complementBase(normalized.alt);

  return (
    isClinvarInput &&
    isSameReferenceError(error) &&
    !!complementedRef &&
    !!complementedAlt &&
    complementedRef !== complementedAlt &&
    (complementedRef !== normalized.ref || complementedAlt !== normalized.alt)
  );
}

function isSameReferenceError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Alternative base must be different from (the )?reference base/i.test(
    message,
  );
}

export async function getDiseaseAssociation({
  supabase,
  normalized,
  evo2,
}: {
  supabase: SupabaseClient;
  normalized: NormalizedVariant;
  evo2: Evo2Result;
}): Promise<Omit<VariantAnalysisResult, "evo2">> {
  const diseaseAssociation = await getOptionalDiseaseAssociation({
    supabase,
    normalized,
    evo2,
  });

  return {
    variant_key: normalized.variant_key,
    gene: normalized.gene,
    normalized_variant: normalized,
    disease_association: diseaseAssociation,
    clinvar_evidence: diseaseAssociation.clinvar_evidence,
    disease_model_ranking: diseaseAssociation.disease_model_ranking,
    final_interpretation: diseaseAssociation.final_interpretation,
    model_version: diseaseAssociation.model_version,
    warnings: diseaseAssociation.warnings,
  };
}

export async function runVariantAnalysis({
  supabase,
  input,
}: {
  supabase: SupabaseClient;
  input: VariantPipelineInput;
}): Promise<VariantAnalysisResult> {
  const { normalized, evo2, warnings: evo2Warnings } = await getEvo2ResultWithCache({
    supabase,
    input,
  });
  const diseaseResult = await getDiseaseAssociation({ supabase, normalized, evo2 });

  return {
    ...diseaseResult,
    evo2,
    warnings: [...evo2Warnings, ...diseaseResult.warnings],
  };
}

async function getOptionalDiseaseAssociation({
  supabase,
  normalized,
  evo2,
}: {
  supabase: SupabaseClient;
  normalized: NormalizedVariant;
  evo2: Evo2Result;
}): Promise<DiseaseAssociationResult> {
  const warnings: string[] = [];

  try {
    if (!normalized.gene) {
      return unavailableDiseaseAssociation(
        "unsupported_gene",
        warnings,
        "No gene symbol was provided, so the custom disease model was not run.",
      );
    }

    const geneIsSupported = await isGeneSupportedForDiseaseModel(
      supabase,
      normalized,
    );

    if (!geneIsSupported) {
      return unavailableDiseaseAssociation(
        "unsupported_gene",
        warnings,
        `The custom disease model is not configured for ${normalized.gene}.`,
      );
    }

    const exactEvidence = await lookupExactClinvarEvidence(
      supabase,
      normalized,
      warnings,
    );
    const candidates = await buildDiseaseCandidates(
      supabase,
      normalized,
      exactEvidence,
      warnings,
    );
    const { ranking, modelVersion, unavailable } = await rankCandidateDiseases(
      candidates,
      warnings,
    );

    if (unavailable || hasDiseaseSubsystemWarning(warnings)) {
      return {
        status: "model_unavailable",
        clinvar_evidence: exactEvidence,
        disease_model_ranking: ranking,
        final_interpretation: null,
        model_version: modelVersion,
        warnings,
      };
    }

    await persistDiseasePredictions(
      supabase,
      normalized,
      ranking,
      modelVersion,
      warnings,
    );

    if (!exactEvidence.length && !ranking.length) {
      return {
        status: "no_evidence_found",
        clinvar_evidence: [],
        disease_model_ranking: [],
        final_interpretation: null,
        model_version: modelVersion,
        warnings,
      };
    }

    const topDiseaseScore = ranking[0]?.association_score ?? null;
    const exactSigGroup =
      exactEvidence[0]?.sig_group ??
      deriveSignificanceGroup(exactEvidence[0]?.clinical_significance);

    return {
      status: "available",
      clinvar_evidence: exactEvidence,
      disease_model_ranking: ranking,
      final_interpretation: finalInterpretation({
        evo2Prediction: evo2.prediction,
        evo2Score: evo2.score,
        exactClinvarFound: exactEvidence.length > 0,
        exactClinvarSigGroup: exactSigGroup,
        topDiseaseScore,
      }),
      model_version: modelVersion,
      warnings,
    };
  } catch (error) {
    return unavailableDiseaseAssociation(
      "model_unavailable",
      warnings,
      error instanceof Error
        ? `Disease association unavailable: ${error.message}`
        : "Disease association unavailable.",
    );
  }
}

function unavailableDiseaseAssociation(
  status: Exclude<DiseaseAssociationStatus, "available">,
  warnings: string[],
  warning: string,
): DiseaseAssociationResult {
  return {
    status,
    clinvar_evidence: [],
    disease_model_ranking: [],
    final_interpretation: null,
    model_version: null,
    warnings: [...warnings, warning],
  };
}

function hasDiseaseSubsystemWarning(warnings: string[]) {
  return warnings.some((warning) => {
    const normalized = warning.toLowerCase();
    return (
      normalized.includes("clinvar exact lookup unavailable") ||
      normalized.includes("clinvar gene candidate lookup unavailable") ||
      normalized.includes("disease model service is not configured") ||
      normalized.includes("disease model service error") ||
      normalized.includes("disease model request failed")
    );
  });
}

export function finalInterpretation({
  evo2Prediction,
  evo2Score,
  exactClinvarFound,
  exactClinvarSigGroup,
  topDiseaseScore,
}: {
  evo2Prediction: Evo2Prediction;
  evo2Score: number | null;
  exactClinvarFound: boolean;
  exactClinvarSigGroup: string | null;
  topDiseaseScore: number | null;
}): FinalInterpretation {
  const warning = "This is research support, not a clinical diagnosis.";
  const scoreText =
    typeof topDiseaseScore === "number"
      ? ` The top ML association score is ${Math.round(topDiseaseScore * 100)}%.`
      : "";
  const evo2Text =
    typeof evo2Score === "number"
      ? ` Evo2 score: ${Math.round(evo2Score * 100)}%.`
      : "";

  if (exactClinvarFound && exactClinvarSigGroup === "vus") {
    return {
      level: "insufficient",
      message:
        "Insufficient evidence: an exact ClinVar match exists, but its significance is uncertain.",
      confidence_explanation:
        "VUS/uncertain ClinVar records are not treated as confirmed disease evidence." +
        evo2Text,
      warning,
    };
  }

  if (exactClinvarFound && isPathogenicEvo2(evo2Prediction)) {
    return {
      level: "strong",
      message:
        "Strong evidence: Evo2 predicts pathogenicity and exact ClinVar disease evidence exists.",
      confidence_explanation:
        "ClinVar exact-match evidence is curated; the ML score is a research ranking score, not diagnostic certainty." +
        scoreText,
      warning,
    };
  }

  if (exactClinvarFound && isBenignEvo2(evo2Prediction)) {
    return {
      level: "conflicting",
      message:
        "Conflicting evidence: exact ClinVar disease evidence exists, but Evo2 predicts a benign effect.",
      confidence_explanation:
        "Curated disease evidence and runtime pathogenicity prediction disagree, so this needs expert review.",
      warning,
    };
  }

  if (
    !exactClinvarFound &&
    isPathogenicEvo2(evo2Prediction) &&
    typeof topDiseaseScore === "number" &&
    topDiseaseScore >= MIN_HIGH_DISEASE_SCORE
  ) {
    return {
      level: "possible",
      message:
        "Possible disease association: Evo2 predicts pathogenicity and the ML disease ranking is high, but no exact ClinVar disease evidence was found.",
      confidence_explanation:
        "This result is based on candidate disease ranking, not an exact curated variant-disease match." +
        scoreText,
      warning,
    };
  }

  if (!exactClinvarFound && isBenignEvo2(evo2Prediction)) {
    return {
      level: "low",
      message:
        "Low or insufficient disease association: Evo2 predicts a benign effect and no strong curated disease evidence was found.",
      confidence_explanation:
        "The app did not find exact ClinVar disease evidence for this selected SNV.",
      warning,
    };
  }

  return {
    level: "insufficient",
    message:
      "Insufficient evidence: available curated and model evidence is not strong enough for a disease association.",
    confidence_explanation:
      "Missing evidence is reported as missing; the app does not infer a confirmed association from placeholders or absent data.",
    warning,
  };
}

export async function persistAnalysisHistory({
  supabase,
  userId,
  result,
}: {
  supabase: SupabaseClient;
  userId: string;
  result: VariantAnalysisResult;
}) {
  const primaryClinvar = result.clinvar_evidence[0];

  const historyRow = {
    user_id: userId,
    variant_key: result.variant_key,
    variant_position: result.normalized_variant.pos,
    alternative: result.normalized_variant.alt,
    reference: result.normalized_variant.ref,
    genome_assembly: result.normalized_variant.assembly,
    chromosome: `chr${result.normalized_variant.chrom}`,
    variant_type: "SNV",
    hgvs_g: result.normalized_variant.hgvs_g,
    rsid: result.normalized_variant.rsid,
    clinvar_variation_id:
      result.normalized_variant.clinvar_variation_id ??
      primaryClinvar?.variation_id ??
      null,
    gene_symbol: result.normalized_variant.gene,
    transcript_id: result.normalized_variant.transcript_id,
    source: result.normalized_variant.source,
    prediction: result.evo2.prediction,
    delta_score: result.evo2.delta_score,
    confidence: result.evo2.confidence,
    clinvar_evidence: result.clinvar_evidence,
    disease_model_ranking: result.disease_model_ranking,
    final_interpretation: result.final_interpretation,
  };

  const { error } = await supabase.from("prediction_history").insert(historyRow);
  if (error) {
    console.warn(
      "Could not persist enriched variant analysis history:",
      error.message,
    );

    const { error: legacyError } = await supabase
      .from("prediction_history")
      .insert({
        user_id: userId,
        variant_position: result.normalized_variant.pos,
        alternative: result.normalized_variant.alt,
        reference: result.normalized_variant.ref,
        genome_assembly: result.normalized_variant.assembly,
        chromosome: `chr${result.normalized_variant.chrom}`,
        prediction: result.evo2.prediction,
        delta_score: result.evo2.delta_score,
        confidence: result.evo2.confidence,
      });

    if (legacyError) {
      console.warn(
        "Could not persist legacy variant analysis history:",
        legacyError.message,
      );

      const { error: minimalError } = await supabase
        .from("prediction_history")
        .insert({
          user_id: userId,
          variant_position: result.normalized_variant.pos,
          genome_assembly: result.normalized_variant.assembly,
          chromosome: `chr${result.normalized_variant.chrom}`,
          prediction: result.evo2.prediction,
          delta_score: result.evo2.delta_score,
          confidence: result.evo2.confidence,
        });

      if (minimalError) {
        console.warn(
          "Could not persist minimal variant analysis history:",
          minimalError.message,
        );
      }
    }
  }
}

function normalizeAssembly(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["grch37", "grch37.p13"].includes(normalized)) return "hg19";
  if (["grch38", "grch38.p13", "grch38.p14"].includes(normalized)) return "hg38";
  return normalized || "hg38";
}

function normalizeChromosome(value: string) {
  const withoutPrefix = value.trim().replace(/^chr/i, "");
  return withoutPrefix.toUpperCase() === "M" ? "MT" : withoutPrefix.toUpperCase();
}

function normalizeGeneSymbol(value: string | undefined) {
  const normalized = value?.trim().toUpperCase().replace(/\s+/g, " ") ?? "";
  if (!normalized) {
    return "";
  }

  const leadingSymbol = normalized.match(/^[A-Z0-9][A-Z0-9.-]*/)?.[0] ?? "";
  if (looksLikeGeneSymbol(leadingSymbol)) {
    return leadingSymbol;
  }

  return normalized;
}

function looksLikeGeneSymbol(value: string) {
  if (!/^[A-Z0-9][A-Z0-9.-]{0,30}$/.test(value)) {
    return false;
  }

  return !new Set([
    "ASSOCIATED",
    "DNA",
    "GENE",
    "PROTEIN",
    "REPAIR",
    "RNA",
    "TUMOR",
  ]).has(value);
}

export function normalizeEvo2Prediction(value: unknown): Evo2Prediction {
  const normalized =
    typeof value === "string"
      ? value.trim().toLowerCase().replaceAll("-", "_")
      : "";

  if (normalized.includes("likely") && normalized.includes("pathogenic")) {
    return "likely_pathogenic";
  }
  if (normalized.includes("likely") && normalized.includes("benign")) {
    return "likely_benign";
  }
  if (normalized.includes("pathogenic")) {
    return "pathogenic";
  }
  if (normalized.includes("benign")) {
    return "benign";
  }

  return "uncertain";
}

function createEvo2Result({
  prediction,
  score,
  deltaScore,
  cached,
  rawPrediction,
}: {
  prediction: unknown;
  score: unknown;
  deltaScore: unknown;
  cached: boolean;
  rawPrediction?: string | null;
}): Evo2Result {
  const normalizedPrediction = normalizeEvo2Prediction(prediction);
  const normalizedScore = clampScore(score);

  return {
    prediction: normalizedPrediction,
    classification: formatEvo2PredictionLabel(normalizedPrediction),
    score: normalizedScore,
    confidence: normalizedScore,
    delta_score:
      typeof deltaScore === "number" && Number.isFinite(deltaScore)
        ? deltaScore
        : null,
    cached,
    raw_prediction: rawPrediction ?? null,
  };
}

function formatEvo2PredictionLabel(prediction: Evo2Prediction) {
  return prediction
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isPathogenicEvo2(value: Evo2Prediction) {
  return value === "pathogenic" || value === "likely_pathogenic";
}

function isBenignEvo2(value: Evo2Prediction) {
  return value === "benign" || value === "likely_benign";
}

function clampScore(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 0) {
    return 0;
  }

  return Math.min(value, MAX_DISPLAY_SCORE);
}

async function readCachedEvo2Result(
  supabase: SupabaseClient,
  normalized: NormalizedVariant,
  warnings: string[],
): Promise<Evo2Result | null> {
  const { data, error } = await supabase
    .from("evo2_cache")
    .select("evo2_prediction,evo2_score,delta_score,raw_prediction")
    .eq("assembly", normalized.assembly)
    .eq("variant_key", normalized.variant_key)
    .maybeSingle();

  if (error) {
    warnings.push(`Evo2 cache lookup unavailable: ${error.message}`);
    return null;
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  const row = data as Record<string, unknown>;
  return createEvo2Result({
    prediction: row.evo2_prediction,
    score: row.evo2_score,
    deltaScore: row.delta_score,
    cached: true,
    rawPrediction:
      typeof row.raw_prediction === "string" ? row.raw_prediction : null,
  });
}

async function writeCachedEvo2Result(
  supabase: SupabaseClient,
  normalized: NormalizedVariant,
  evo2: Evo2Result,
  warnings: string[],
) {
  const { error } = await supabase.from("evo2_cache").upsert(
    {
      variant_key: normalized.variant_key,
      assembly: normalized.assembly,
      gene: normalized.gene,
      chrom: normalized.chrom,
      pos: normalized.pos,
      ref: normalized.ref,
      alt: normalized.alt,
      evo2_prediction: evo2.prediction,
      evo2_score: evo2.score,
      delta_score: evo2.delta_score,
      raw_prediction: evo2.raw_prediction ?? evo2.prediction,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "assembly,variant_key" },
  );

  if (error) {
    warnings.push(`Evo2 cache write unavailable: ${error.message}`);
  }
}

async function runEvo2Modal(normalized: NormalizedVariant): Promise<Evo2Result> {
  const modalUrl = process.env.MODAL_ENDPOINT_URL;
  const modalApiKey = process.env.MODAL_API_KEY;

  if (!modalUrl || !modalApiKey) {
    throw new Error("Evo2 service is not configured.");
  }

  const response = await fetch(modalUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": modalApiKey,
    },
    body: JSON.stringify({
      variant_position: normalized.pos,
      alternative: normalized.alt,
      genome: normalized.assembly,
      chromosome: `chr${normalized.chrom}`,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseServiceError(response, "Evo2 service error"));
  }

  const payload = (await response.json()) as ModalEvo2Result;
  const rawPrediction =
    typeof payload.prediction === "string" ? payload.prediction : "uncertain";

  return createEvo2Result({
    prediction: rawPrediction,
    score: payload.classification_confidence,
    deltaScore: payload.delta_score,
    cached: false,
    rawPrediction,
  });
}

async function isGeneSupportedForDiseaseModel(
  supabase: SupabaseClient,
  normalized: NormalizedVariant,
) {
  if (!normalized.gene) {
    return false;
  }

  const { count, error } = await supabase
    .from("clinvar_disease_lookup")
    .select("*", { count: "exact", head: true })
    .eq("assembly", normalized.assembly)
    .eq("gene", normalized.gene);

  if (error) {
    throw new Error(`ClinVar gene support lookup unavailable: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

async function lookupExactClinvarEvidence(
  supabase: SupabaseClient,
  normalized: NormalizedVariant,
  warnings: string[],
): Promise<ClinvarEvidence[]> {
  const { data, error } = await supabase
    .from("clinvar_disease_lookup")
    .select(
      "disease_name,disease_id,clinical_significance,sig_group,review_status,review_score,variation_id,rsid,source",
    )
    .eq("assembly", normalized.assembly)
    .in("variant_key", getClinvarLookupVariantKeys(normalized))
    .limit(50);

  if (error) {
    warnings.push(`ClinVar exact lookup unavailable: ${error.message}`);
    return [];
  }

  const rows = Array.isArray(data) ? (data as ClinvarLookupRow[]) : [];
  return dedupeEvidence(rows.map(toClinvarEvidence).filter(isUsableEvidence));
}

async function buildDiseaseCandidates(
  supabase: SupabaseClient,
  normalized: NormalizedVariant,
  exactEvidence: ClinvarEvidence[],
  warnings: string[],
): Promise<DiseaseModelCandidate[]> {
  const candidatesByDisease = new Map<string, DiseaseModelCandidate>();
  const addCandidate = (diseaseName: string, reviewScore: number) => {
    const cleanedDiseaseName = diseaseName.trim();
    if (!isUsableDiseaseName(cleanedDiseaseName) || !normalized.gene) {
      return;
    }

    const existing = candidatesByDisease.get(cleanedDiseaseName);
    const nextReviewScore = Math.max(existing?.review_score ?? 0, reviewScore);

    candidatesByDisease.set(cleanedDiseaseName, {
      chrom: normalized.chrom,
      pos: normalized.pos,
      ref: normalized.ref,
      alt: normalized.alt,
      gene: normalized.gene,
      disease_name: cleanedDiseaseName,
      review_score: nextReviewScore,
      is_transition: isTransition(normalized.ref, normalized.alt) ? 1 : 0,
      position_mod_1000: normalized.pos % 1000,
    });
  };

  for (const evidence of exactEvidence) {
    addCandidate(evidence.disease_name, evidence.review_score ?? 0);
  }

  if (!normalized.gene) {
    warnings.push("No gene symbol was provided, so gene-level disease candidates could not be generated.");
    return [...candidatesByDisease.values()];
  }

  const { data, error } = await supabase
    .from("clinvar_disease_lookup")
    .select("disease_name,review_score")
    .eq("assembly", normalized.assembly)
    .eq("gene", normalized.gene)
    .limit(1000);

  if (error) {
    warnings.push(`ClinVar gene candidate lookup unavailable: ${error.message}`);
    return [...candidatesByDisease.values()];
  }

  const rows = Array.isArray(data) ? (data as ClinvarLookupRow[]) : [];
  for (const row of rows) {
    const diseaseName = stringOrNull(row.disease_name);
    if (diseaseName) {
      addCandidate(diseaseName, 0);
    }
  }

  const candidates = [...candidatesByDisease.values()];
  if (!candidates.length) {
    warnings.push("No candidate diseases were found for this selected SNV/gene.");
  }

  return candidates;
}

async function rankCandidateDiseases(
  candidates: DiseaseModelCandidate[],
  warnings: string[],
): Promise<{
  ranking: DiseaseModelRanking[];
  modelVersion: string | null;
  unavailable: boolean;
}> {
  if (!candidates.length) {
    return { ranking: [], modelVersion: null, unavailable: false };
  }

  const endpointUrl = process.env.DISEASE_MODEL_ENDPOINT_URL;
  const apiKey = process.env.MODAL_API_KEY;
  if (!endpointUrl || !apiKey) {
    warnings.push("Disease model service is not configured.");
    return { ranking: [], modelVersion: null, unavailable: true };
  }

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        model_version: DISEASE_MODEL_VERSION,
        candidates,
      }),
    });

    if (!response.ok) {
      warnings.push(await parseServiceError(response, "Disease model service error"));
      return { ranking: [], modelVersion: null, unavailable: true };
    }

    const payload = (await response.json()) as DiseaseRankerResponse;
    const serviceError = stringOrNull(payload.error);
    if (serviceError) {
      warnings.push(
        stringOrNull(payload.detail) ??
          `Disease model returned ${serviceError}.`,
      );

      return {
        ranking: [],
        modelVersion:
          typeof payload.model_version === "string"
            ? payload.model_version
            : DISEASE_MODEL_VERSION,
        unavailable: !["no_candidates", "no_usable_candidates"].includes(
          serviceError,
        ),
      };
    }

    const rawRanking = Array.isArray(payload.ranking) ? payload.ranking : [];
    const ranking = rawRanking
      .map((item): DiseaseModelRanking | null => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const row = item as Record<string, unknown>;
        const diseaseName = stringOrNull(row.disease_name);
        const score = clampScore(row.association_score);

        if (!diseaseName || score === null || !isUsableDiseaseName(diseaseName)) {
          return null;
        }

        return {
          disease_name: diseaseName,
          association_score: score,
          source: "custom_ml_model",
        };
      })
      .filter((item): item is DiseaseModelRanking => item !== null)
      .sort((first, second) => second.association_score - first.association_score)
      .slice(0, 10);

    if (!ranking.length) {
      warnings.push("Disease model returned no usable ranked disease associations.");
    }

    return {
      ranking,
      modelVersion:
        typeof payload.model_version === "string"
          ? payload.model_version
          : DISEASE_MODEL_VERSION,
      unavailable: false,
    };
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Disease model request failed: ${error.message}`
        : "Disease model request failed.",
    );
    return { ranking: [], modelVersion: null, unavailable: true };
  }
}

async function persistDiseasePredictions(
  supabase: SupabaseClient,
  normalized: NormalizedVariant,
  ranking: DiseaseModelRanking[],
  modelVersion: string | null,
  warnings: string[],
) {
  if (!ranking.length) {
    return;
  }

  const rows = ranking.slice(0, 10).map((item) => ({
    variant_key: normalized.variant_key,
    assembly: normalized.assembly,
    gene: normalized.gene,
    disease_name: item.disease_name,
    association_score: item.association_score,
    source: item.source,
    model_version: modelVersion,
  }));

  const { error } = await supabase.from("disease_predictions").insert(rows);
  if (error) {
    warnings.push(`Disease prediction persistence unavailable: ${error.message}`);
  }
}

function toClinvarEvidence(row: ClinvarLookupRow): ClinvarEvidence {
  return {
    disease_name: stringOrNull(row.disease_name) ?? "",
    disease_id: stringOrNull(row.disease_id),
    clinical_significance: stringOrNull(row.clinical_significance),
    sig_group:
      stringOrNull(row.sig_group) ??
      deriveSignificanceGroup(stringOrNull(row.clinical_significance)),
    review_status: stringOrNull(row.review_status),
    review_score: numberOrNull(row.review_score),
    variation_id: stringOrNull(row.variation_id),
    rsid: stringOrNull(row.rsid),
    source: stringOrNull(row.source) ?? "ClinVar",
  };
}

function isUsableEvidence(evidence: ClinvarEvidence) {
  return isUsableDiseaseName(evidence.disease_name);
}

function dedupeEvidence(evidence: ClinvarEvidence[]) {
  const seen = new Set<string>();
  const deduped: ClinvarEvidence[] = [];

  for (const item of evidence) {
    const key = `${item.disease_name.toLowerCase()}|${item.variation_id ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  return deduped.sort(
    (first, second) => (second.review_score ?? 0) - (first.review_score ?? 0),
  );
}

function deriveSignificanceGroup(value: string | null | undefined) {
  const normalized = String(value ?? "").toLowerCase();

  if (normalized.includes("conflicting")) return "conflicting";
  if (normalized.includes("uncertain") || normalized.includes("vus")) return "vus";
  if (normalized.includes("pathogenic")) return "pathogenic";
  if (normalized.includes("benign")) return "benign";

  return null;
}

function isUsableDiseaseName(value: string) {
  return !BAD_DISEASE_NAMES.has(value.trim().toLowerCase());
}

function isTransition(ref: string, alt: string) {
  return (
    (ref === "A" && alt === "G") ||
    (ref === "G" && alt === "A") ||
    (ref === "C" && alt === "T") ||
    (ref === "T" && alt === "C")
  );
}

function getClinvarLookupVariantKeys(normalized: NormalizedVariant) {
  const keys = [normalized.variant_key];
  const complementedRef = complementBase(normalized.ref);
  const complementedAlt = complementBase(normalized.alt);

  if (complementedRef && complementedAlt) {
    keys.push(
      `${normalized.chrom}:${normalized.pos}:${complementedRef}>${complementedAlt}`,
    );
  }

  return [...new Set(keys)];
}

function complementBase(value: string) {
  if (value === "A") return "T";
  if (value === "T") return "A";
  if (value === "C") return "G";
  if (value === "G") return "C";
  return null;
}

function stringOrNull(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

async function parseServiceError(response: Response, fallback: string) {
  const text = await response.text();
  if (!text) {
    return fallback;
  }

  try {
    const payload = JSON.parse(text) as Record<string, unknown>;
    if (typeof payload.error === "string") {
      return payload.error;
    }
    if (typeof payload.detail === "string") {
      return payload.detail;
    }
    if (
      payload.detail &&
      typeof payload.detail === "object" &&
      "message" in payload.detail &&
      typeof payload.detail.message === "string"
    ) {
      return payload.detail.message;
    }
  } catch {
    return text;
  }

  return fallback;
}
