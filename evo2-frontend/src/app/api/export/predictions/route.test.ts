import { describe, expect, it } from "vitest";

import { getDatasetQualityFlags, toCsv } from "~/lib/prediction-csv";

describe("prediction CSV export helpers", () => {
  it("exports enriched prediction history with clinical evidence and final interpretation", () => {
    const csv = toCsv([
      {
        created_at: "2026-07-07T10:15:00.000Z",
        genome_assembly: "hg19",
        chromosome: "chr11",
        variant_position: 5227002,
        reference: "T",
        alternative: "A",
        variant_type: "SNV",
        hgvs_g: "chr11:g.5227002T>A",
        rsid: "rs334",
        clinvar_variation_id: "15333",
        gene_symbol: "HBB",
        transcript_id: "NM_000518.5",
        source: "clinvar",
        prediction: "pathogenic",
        delta_score: -2.4,
        confidence: 0.91,
        clinvar_evidence: [{ disease_name: "Sickle cell disease" }],
        disease_model_ranking: [
          { disease_name: "Sickle cell disease", association_score: 0.97 },
        ],
        final_interpretation: {
          level: "strong",
          message: "Strong evidence: exact ClinVar disease evidence exists.",
        },
      },
    ]);

    expect(csv).toContain("Date,Genome Assembly,Chromosome,Variant Position");
    expect(csv).toContain(
      "2026-07-07T10:15:00.000Z,hg19,chr11,5227002,T,A,SNV",
    );
    expect(csv).toContain(
      "chr11:g.5227002T>A,rs334,15333,HBB,NM_000518.5,clinvar",
    );
    expect(csv).toContain("pathogenic,'-2.4,0.91");
    expect(csv).toContain("research_only");
    expect(csv).toContain("ok");
  });

  it("escapes CSV formulas, quotes, commas, and JSON fields safely", () => {
    const csv = toCsv([
      {
        created_at: "not-a-date",
        genome_assembly: "hg38",
        chromosome: "chr1",
        variant_position: "100",
        reference: "A",
        alternative: "G",
        prediction: '=IMPORTXML("https://evil.test")',
        final_interpretation: {
          level: "possible",
          message: 'Possible, needs "review"',
        },
      },
    ]);

    expect(csv).toContain("'=IMPORTXML");
    expect(csv).not.toContain("Possible, needs");
    expect(csv).toContain("skipped_uncertain");
  });

  it("flags invalid and duplicate variant rows for dataset quality", () => {
    const duplicateKeys = new Set(["hg38:chr1:100:A>G"]);

    expect(
      getDatasetQualityFlags(
        {
          genome_assembly: "hg38",
          chromosome: "chr1",
          variant_position: "100",
          reference: "A",
          alternative: "G",
          variant_type: "SNV",
        },
        duplicateKeys,
      ),
    ).toContain("duplicate_variant");

    expect(
      getDatasetQualityFlags(
        {
          chromosome: "badChrom",
          reference: "N",
          alternative: "N",
          variant_type: "DEL",
        },
        new Set(),
      ),
    ).toBe(
      "missing_position;reference_equals_alternate;invalid_chromosome;invalid_ref;invalid_alt;unsupported_variant_type;missing_identifier",
    );
  });
});
