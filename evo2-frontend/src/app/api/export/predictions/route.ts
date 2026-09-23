import { toCsv, type PredictionHistoryRow } from "~/lib/prediction-csv";
import { NextResponse } from "next/server";

import { getPlanLimits } from "~/lib/plans";
import { ACTIVE_ACCESS_PLAN } from "~/lib/app-access";
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

async function fetchPredictionRowsForExport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  let lastMissingColumnError: { message: string } | null = null;

  for (const columns of EXPORT_COLUMN_SETS) {
    const { data, error } = await supabase
      .from("prediction_history")
      .select(columns)
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

  const planLimits = getPlanLimits(ACTIVE_ACCESS_PLAN);

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
