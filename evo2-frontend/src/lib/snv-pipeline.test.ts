import { describe, expect, it } from "vitest";

import {
  finalInterpretation,
  isVariantPipelineInput,
  normalizeEvo2Prediction,
  normalizeVariantInput,
} from "./snv-pipeline";

describe("isVariantPipelineInput", () => {
  it("accepts complete SNV pipeline input with optional metadata", () => {
    expect(
      isVariantPipelineInput({
        variant_position: 5227002,
        reference: "T",
        alternative: "A",
        genome: "GRCh37.p13",
        chromosome: "chr11",
        gene_symbol: "HBB",
        rsid: "rs334",
        clinvar_variation_id: "15333",
        hgvs_g: "chr11:g.5227002T>A",
        transcript_id: "NM_000518.5",
        source: "clinvar",
      }),
    ).toBe(true);
  });

  it("rejects malformed required fields", () => {
    expect(
      isVariantPipelineInput({
        variant_position: "5227002",
        reference: "T",
        alternative: "A",
        genome: "hg19",
        chromosome: "11",
      }),
    ).toBe(false);

    expect(
      isVariantPipelineInput({
        variant_position: 5227002,
        reference: "T",
        alternative: "A",
        genome: "hg19",
      }),
    ).toBe(false);
  });
});

describe("normalizeVariantInput", () => {
  it("normalizes assembly, chromosome, alleles, gene symbol, and derived identifiers", () => {
    const normalized = normalizeVariantInput({
      variant_position: 5227002,
      reference: " t ",
      alternative: " a ",
      genome: "GRCh37.p13",
      chromosome: "chr11",
      gene: "HBB associated gene",
      rsid: " rs334 ",
      source: " clinvar ",
    });

    expect(normalized).toMatchObject({
      variant_key: "11:5227002:T>A",
      assembly: "hg19",
      gene: "HBB",
      chrom: "11",
      pos: 5227002,
      ref: "T",
      alt: "A",
      rsid: "rs334",
      hgvs_g: "chr11:g.5227002T>A",
      source: "clinvar",
    });
  });

  it("normalizes mitochondrial chromosome aliases", () => {
    expect(
      normalizeVariantInput({
        variant_position: 100,
        reference: "A",
        alternative: "G",
        genome: "hg38",
        chromosome: "chrM",
      }).chrom,
    ).toBe("MT");
  });

  it("rejects non-SNV alleles and unchanged reference/alternative bases", () => {
    expect(() =>
      normalizeVariantInput({
        variant_position: 1,
        reference: "AT",
        alternative: "A",
        genome: "hg38",
        chromosome: "1",
      }),
    ).toThrow(
      "Only single nucleotide A, C, G, or T substitutions are supported.",
    );

    expect(() =>
      normalizeVariantInput({
        variant_position: 1,
        reference: "A",
        alternative: "A",
        genome: "hg38",
        chromosome: "1",
      }),
    ).toThrow(
      "Alternative base must be different from the reference base (A).",
    );
  });

  it("rejects invalid positions and missing chromosomes", () => {
    expect(() =>
      normalizeVariantInput({
        variant_position: 0,
        reference: "A",
        alternative: "G",
        genome: "hg38",
        chromosome: "1",
      }),
    ).toThrow("Variant position must be a positive integer.");

    expect(() =>
      normalizeVariantInput({
        variant_position: 1,
        reference: "A",
        alternative: "G",
        genome: "hg38",
        chromosome: " ",
      }),
    ).toThrow("Chromosome is required.");
  });
});

describe("normalizeEvo2Prediction", () => {
  it.each([
    ["Likely pathogenic", "likely_pathogenic"],
    ["likely-benign", "likely_benign"],
    ["PATHOGENIC", "pathogenic"],
    ["benign", "benign"],
    ["not enough evidence", "uncertain"],
    [null, "uncertain"],
  ] as const)("normalizes %s to %s", (raw, expected) => {
    expect(normalizeEvo2Prediction(raw)).toBe(expected);
  });
});

describe("finalInterpretation", () => {
  it("reports strong evidence when pathogenic Evo2 output has exact ClinVar evidence", () => {
    const result = finalInterpretation({
      evo2Prediction: "pathogenic",
      evo2Score: 0.91,
      exactClinvarFound: true,
      exactClinvarSigGroup: "pathogenic",
      topDiseaseScore: 0.84,
    });

    expect(result.level).toBe("strong");
    expect(result.message).toContain("Curated pathogenic assertion");
    expect(result.confidence_explanation).toContain("0.840");
    expect(result.warning).toBe(
      "This is research support, not a clinical diagnosis.",
    );
  });

  it("reports conflicting evidence when exact ClinVar evidence conflicts with benign Evo2 output", () => {
    const result = finalInterpretation({
      evo2Prediction: "likely_benign",
      evo2Score: 0.81,
      exactClinvarFound: true,
      exactClinvarSigGroup: "pathogenic",
      topDiseaseScore: 0.9,
    });

    expect(result.level).toBe("conflicting");
    expect(result.message).toContain("Conflicting evidence");
  });

  it("reports possible association when pathogenic Evo2 output has a high disease ranking but no exact ClinVar match", () => {
    const result = finalInterpretation({
      evo2Prediction: "likely_pathogenic",
      evo2Score: 0.88,
      exactClinvarFound: false,
      exactClinvarSigGroup: null,
      topDiseaseScore: 0.75,
    });

    expect(result.level).toBe("possible");
    expect(result.message).toContain("Exploratory disease hypotheses");
  });

  it("treats exact VUS ClinVar evidence as insufficient", () => {
    const result = finalInterpretation({
      evo2Prediction: "pathogenic",
      evo2Score: 0.73,
      exactClinvarFound: true,
      exactClinvarSigGroup: "vus",
      topDiseaseScore: 0.8,
    });

    expect(result.level).toBe("insufficient");
    expect(result.confidence_explanation).toContain("VUS/uncertain");
  });
});
