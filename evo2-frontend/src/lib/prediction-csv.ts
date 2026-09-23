import {
  historicalRankingPolicy,
  rankingPolicyMessage,
  RESEARCH_WARNING,
} from "~/lib/disease-ranking-policy";

const CSV_HEADERS = [
  "Date",
  "Genome Assembly",
  "Chromosome",
  "Variant Position",
  "Reference",
  "Alternative",
  "Variant Type",
  "Genomic HGVS",
  "rsID",
  "ClinVar Variation ID",
  "Gene Symbol",
  "Transcript ID",
  "Source",
  "Evo2 Computational Prediction",
  "Delta Score",
  "Evo2 Model Score (Uncalibrated)",
  "ClinVar Evidence",
  "Exploratory Disease Model Ranking (Not Disease Risk)",
  "Final Interpretation Level",
  "Final Interpretation",
  "Dataset Quality Flags",
  "Disease Ranking Policy",
  "Disease Ranking Notice",
  "Disease Ranking Status",
];

export type PredictionHistoryRow = Record<string, unknown>;

function readString(row: PredictionHistoryRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string") {
      return value;
    }

    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "bigint"
    ) {
      return String(value);
    }
  }

  return "";
}

function readJsonString(row: PredictionHistoryRow, key: string) {
  const value = row[key];
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function sanitizeCsvValue(value: string) {
  if (/^[\s]*[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }

  return value;
}

function escapeCsvValue(value: string) {
  const sanitizedValue = sanitizeCsvValue(value);
  const shouldQuote = /[",\r\n]/.test(sanitizedValue);
  const escapedValue = sanitizedValue.replaceAll('"', '""');

  return shouldQuote ? `"${escapedValue}"` : escapedValue;
}

function formatCsvDate(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
}

function variantIdentity(row: PredictionHistoryRow) {
  const genome = readString(row, ["genome_assembly", "genome"]).toLowerCase();
  const chromosome = readString(row, ["chromosome"]).toLowerCase();
  const position = readString(row, ["variant_position", "position"]);
  const reference = readString(row, [
    "reference",
    "reference_allele",
    "variant_reference",
    "ref",
  ]).toUpperCase();
  const alternative = readString(row, [
    "alternative",
    "alternative_allele",
    "variant_alternative",
    "alt",
  ]).toUpperCase();

  if (!genome || !chromosome || !position || !reference || !alternative) {
    return "";
  }

  return `${genome}:${chromosome}:${position}:${reference}>${alternative}`;
}

function findDuplicateVariantKeys(rows: PredictionHistoryRow[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const key = variantIdentity(row);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key),
  );
}

export function getDatasetQualityFlags(
  row: PredictionHistoryRow,
  duplicateVariantKeys: Set<string>,
) {
  const flags: string[] = [];
  const chromosome = readString(row, ["chromosome"]);
  const position = readString(row, ["variant_position", "position"]);
  const reference = readString(row, [
    "reference",
    "reference_allele",
    "variant_reference",
    "ref",
  ]).toUpperCase();
  const alternative = readString(row, [
    "alternative",
    "alternative_allele",
    "variant_alternative",
    "alt",
  ]).toUpperCase();
  const variantType = readString(row, ["variant_type"]);
  const hasStableIdentifier = !!(
    readString(row, ["hgvs_g"]) ||
    readString(row, ["rsid", "rs_id"]) ||
    readString(row, ["clinvar_variation_id", "clinvar_id"])
  );
  const identity = variantIdentity(row);

  if (!position) flags.push("missing_position");
  if (!reference) flags.push("missing_ref");
  if (!alternative) flags.push("missing_alt");
  if (reference && alternative && reference === alternative) {
    flags.push("reference_equals_alternate");
  }
  if (chromosome && !/^(chr)?([0-9]+|x|y|m|mt)$/i.test(chromosome)) {
    flags.push("invalid_chromosome");
  }
  if (reference && !/^[ACGT]+$/.test(reference)) flags.push("invalid_ref");
  if (alternative && !/^[ACGT]+$/.test(alternative)) flags.push("invalid_alt");
  if (
    (variantType && variantType.toUpperCase() !== "SNV") ||
    reference.length > 1 ||
    alternative.length > 1
  ) {
    flags.push("unsupported_variant_type");
  }
  if (!hasStableIdentifier && !identity) flags.push("missing_identifier");
  if (identity && duplicateVariantKeys.has(identity))
    flags.push("duplicate_variant");

  return flags.length ? flags.join(";") : "ok";
}

export function toCsv(rows: PredictionHistoryRow[]) {
  const duplicateVariantKeys = findDuplicateVariantKeys(rows);
  const csvRows = [
    CSV_HEADERS,
    ...rows.map((original) => {
      const policy = historicalRankingPolicy(
        original.prediction,
        original.final_interpretation,
      );
      const rawInterpretation = original.final_interpretation;
      const interpretation =
        rawInterpretation && typeof rawInterpretation === "object"
          ? (rawInterpretation as Record<string, unknown>)
          : null;
      const currentInterpretation =
        interpretation?.ranking_policy_version === 1 ? interpretation : null;
      const skipped =
        policy === "skipped_benign" || policy === "skipped_uncertain";
      const row: PredictionHistoryRow = {
        ...original,
        disease_model_ranking: skipped ? [] : original.disease_model_ranking,
      };
      return [
        formatCsvDate(readString(row, ["created_at", "date"])),
        readString(row, ["genome_assembly", "genome"]),
        readString(row, ["chromosome"]),
        readString(row, ["variant_position", "position"]),
        readString(row, [
          "reference",
          "reference_allele",
          "variant_reference",
          "ref",
        ]),
        readString(row, [
          "alternative",
          "alternative_allele",
          "variant_alternative",
          "alt",
        ]),
        readString(row, ["variant_type"]),
        readString(row, ["hgvs_g"]),
        readString(row, ["rsid", "rs_id"]),
        readString(row, ["clinvar_variation_id", "clinvar_id"]),
        readString(row, ["gene_symbol", "gene"]),
        readString(row, ["transcript_id"]),
        readString(row, ["source"]),
        readString(row, ["prediction"]),
        readString(row, ["delta_score"]),
        readString(row, ["confidence", "classification_confidence"]),
        readJsonString(row, "clinvar_evidence"),
        readJsonString(row, "disease_model_ranking"),
        readString(currentInterpretation ?? {}, ["level"]) ||
          (skipped ? "insufficient" : "research_only"),
        readString(currentInterpretation ?? {}, ["message"]) ||
          (skipped
            ? "Historical ML rankings are withheld under the current classification policy. Curated evidence remains available."
            : RESEARCH_WARNING),
        getDatasetQualityFlags(row, duplicateVariantKeys),
        policy,
        currentInterpretation
          ? rankingPolicyMessage(policy, row.prediction)
          : skipped
            ? "Historical ML rankings are withheld under the current classification policy. Curated evidence remains available."
            : RESEARCH_WARNING,
        readString(currentInterpretation ?? {}, ["ranking_status"]) ||
          "legacy_status_unknown",
      ];
    }),
  ];

  return csvRows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\r\n");
}
