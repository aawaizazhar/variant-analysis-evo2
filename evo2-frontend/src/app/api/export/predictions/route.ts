import { NextResponse } from "next/server";

import { getPlanLimits, normalizePlanType } from "~/lib/plans";
import { createClient } from "~/utils/supabase/server";

/** Columns needed for CSV export, with fallbacks for older history schemas. */
const EXPORT_IDENTITY_COLUMNS =
  "created_at, genome_assembly, chromosome, variant_position";
const EXPORT_LEGACY_RESULT_COLUMNS = "prediction, delta_score, confidence";
const EXPORT_ENRICHED_RESULT_COLUMNS =
  "variant_type, hgvs_g, rsid, clinvar_variation_id, gene_symbol, transcript_id, source, prediction, delta_score, confidence, clinvar_evidence, disease_model_ranking, final_interpretation";
const EXPORT_ALLELE_COLUMN_SETS = [
  "reference, alternative",
  "reference_allele, alternative_allele",
  "variant_reference, variant_alternative",
  "ref, alt",
] as const;
const EXPORT_COLUMN_SETS = [
  ...EXPORT_ALLELE_COLUMN_SETS.map(
    (alleleColumns) =>
      `${EXPORT_IDENTITY_COLUMNS}, ${alleleColumns}, ${EXPORT_ENRICHED_RESULT_COLUMNS}`,
  ),
  `${EXPORT_IDENTITY_COLUMNS}, ${EXPORT_ENRICHED_RESULT_COLUMNS}`,
  ...EXPORT_ALLELE_COLUMN_SETS.map(
    (alleleColumns) =>
      `${EXPORT_IDENTITY_COLUMNS}, ${alleleColumns}, ${EXPORT_LEGACY_RESULT_COLUMNS}`,
  ),
  `${EXPORT_IDENTITY_COLUMNS}, ${EXPORT_LEGACY_RESULT_COLUMNS}`,
] as const;

/** Safety cap for export rows. */
const EXPORT_ROW_LIMIT = 5000;

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
  "Prediction",
  "Delta Score",
  "Confidence",
  "ClinVar Evidence",
  "Disease Model Ranking",
  "Final Interpretation Level",
  "Final Interpretation",
  "Dataset Quality Flags",
];

type PredictionHistoryRow = Record<string, unknown>;

function formatDateForFilename(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isMissingColumnError(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";

  return (
    /column .* does not exist/i.test(message) ||
    /could not find .* column .* schema cache/i.test(message)
  );
}

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

function readFinalInterpretationLevel(row: PredictionHistoryRow) {
  const value = row.final_interpretation;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const level = (value as Record<string, unknown>).level;
    return typeof level === "string" ? level : "";
  }

  return "";
}

function readFinalInterpretationMessage(row: PredictionHistoryRow) {
  const value = row.final_interpretation;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const message = (value as Record<string, unknown>).message;
    return typeof message === "string" ? message : "";
  }

  return "";
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
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key),
  );
}

function getDatasetQualityFlags(
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
  if (identity && duplicateVariantKeys.has(identity)) flags.push("duplicate_variant");

  return flags.length ? flags.join(";") : "ok";
}

function toCsv(rows: PredictionHistoryRow[]) {
  const duplicateVariantKeys = findDuplicateVariantKeys(rows);
  const csvRows = [
    CSV_HEADERS,
    ...rows.map((row) => [
      formatCsvDate(readString(row, ["created_at", "date"])),
      readString(row, ["genome_assembly", "genome"]),
      readString(row, ["chromosome"]),
      readString(row, ["variant_position", "position"]),
      readString(row, ["reference", "reference_allele", "variant_reference", "ref"]),
      readString(row, ["alternative", "alternative_allele", "variant_alternative", "alt"]),
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
      readFinalInterpretationLevel(row),
      readFinalInterpretationMessage(row),
      getDatasetQualityFlags(row, duplicateVariantKeys),
    ]),
  ];

  return csvRows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\r\n");
}

async function fetchPredictionRowsForExport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  let lastMissingColumnError: { message: string } | null = null;

  for (const columns of EXPORT_COLUMN_SETS) {
    const { data, error } = await supabase
      .from("prediction_history")
      .select(columns as string)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(EXPORT_ROW_LIMIT);

    if (!error) {
      return {
        data: Array.isArray(data)
          ? (data as unknown as PredictionHistoryRow[])
          : [],
        error: null,
      };
    }

    if (!isMissingColumnError(error)) {
      return { data: null, error };
    }

    lastMissingColumnError = error;
  }

  return { data: null, error: lastMissingColumnError };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan_type")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load plan for CSV export:", profileError.message);
  }

  const planType = normalizePlanType(profile?.plan_type);
  const planLimits = getPlanLimits(planType);

  if (!planLimits.csvExport) {
    return NextResponse.json(
      { error: "CSV export is available on the Researcher plan." },
      { status: 403 },
    );
  }

  const { data, error } = await fetchPredictionRowsForExport(supabase, user.id);

  if (error) {
    console.error("Failed to export prediction history:", error.message);
    return NextResponse.json(
      { error: "Failed to export prediction history" },
      { status: 500 },
    );
  }

  const filename = `dna-analyzer-prediction-history-${formatDateForFilename(
    new Date(),
  )}.csv`;
  const rows: PredictionHistoryRow[] = Array.isArray(data)
    ? data.filter(
        (row): row is PredictionHistoryRow =>
          row !== null && typeof row === "object" && !Array.isArray(row),
      )
    : [];

  return new NextResponse(toCsv(rows), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
