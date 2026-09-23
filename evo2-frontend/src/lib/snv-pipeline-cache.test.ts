import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getDiseaseAssociation,
  getEvo2ResultWithCache,
  type VariantPipelineInput,
} from "./snv-pipeline";

type QueryResult = { data?: unknown; error?: { message: string } | null };

function createSupabaseStub(result: QueryResult) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const gte = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ eq, gte, maybeSingle }));
  const select = vi.fn(() => ({ eq, maybeSingle }));
  const from = vi.fn((table: string) => {
    if (table === "evo2_cache") {
      return { select, upsert };
    }

    return { select };
  });

  return {
    client: { from },
    spies: { from, select, eq, gte, maybeSingle, upsert },
  };
}

const input: VariantPipelineInput = {
  variant_position: 5227002,
  reference: "T",
  alternative: "A",
  genome: "GRCh37",
  chromosome: "chr11",
  gene: "HBB",
};

describe("getEvo2ResultWithCache", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns cached Evo2 predictions without calling the Modal endpoint", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T12:00:00.000Z"));

    const { client, spies } = createSupabaseStub({
      data: {
        evo2_prediction: "Likely pathogenic",
        evo2_score: 1.2,
        delta_score: -3.5,
        raw_prediction: "Likely pathogenic",
      },
      error: null,
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await getEvo2ResultWithCache({
      supabase: client as never,
      input,
    });

    expect(result.normalized.variant_key).toBe("11:5227002:T>A");
    expect(result.evo2).toMatchObject({
      prediction: "likely_pathogenic",
      classification: "Likely Pathogenic",
      score: 0.99,
      confidence: 0.99,
      delta_score: -3.5,
      cached: true,
      raw_prediction: "Likely pathogenic",
    });
    expect(result.warnings).toEqual([]);
    expect(spies.gte).toHaveBeenCalledWith(
      "updated_at",
      "2026-03-23T12:00:00.000Z",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(spies.upsert).not.toHaveBeenCalled();
  });

  it("runs Evo2, writes cache, and returns a warning when the cache lookup fails", async () => {
    const { client, spies } = createSupabaseStub({
      data: null,
      error: { message: "cache unavailable" },
    });
    vi.stubEnv("MODAL_ENDPOINT_URL", "https://modal.example/evo2");
    vi.stubEnv("MODAL_API_KEY", "secret-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          prediction: "benign",
          classification_confidence: 0.82,
          delta_score: 0.15,
        }),
      }),
    );

    const result = await getEvo2ResultWithCache({
      supabase: client as never,
      input,
    });

    expect(result.evo2).toMatchObject({
      prediction: "benign",
      score: 0.82,
      confidence: 0.82,
      delta_score: 0.15,
      cached: false,
    });
    expect(result.warnings).toEqual([
      "Evo2 cache lookup unavailable: cache unavailable",
    ]);
    expect(spies.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        variant_key: "11:5227002:T>A",
        assembly: "hg19",
        gene: "HBB",
        evo2_prediction: "benign",
      }),
      { onConflict: "assembly,variant_key" },
    );
  });

  it("surfaces configuration errors when Evo2 is not configured and no cache exists", async () => {
    const { client } = createSupabaseStub({ data: null, error: null });

    await expect(
      getEvo2ResultWithCache({
        supabase: client as never,
        input,
      }),
    ).rejects.toThrow("Evo2 service is not configured.");
  });
});

describe("shared disease-analysis cache", () => {
  it("reuses a matching result created within the six-month window", async () => {
    const cachedAssociation = {
      status: "available",
      clinvar_evidence: [],
      disease_model_ranking: [
        {
          disease_name: "Example condition",
          association_score: 0.81,
          source: "custom_ml_model",
        },
      ],
      final_interpretation: {
        level: "possible",
        message: "Cached result",
        confidence_explanation: "Cached explanation",
        warning: "Research use only",
      },
      model_version: "test-model",
      warnings: [],
    };
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { disease_association: cachedAssociation },
      error: null,
    });
    const limit = vi.fn(() => ({ maybeSingle }));
    const order = vi.fn(() => ({ limit }));
    const gte = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ eq, gte }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await getDiseaseAssociation({
      supabase: { from } as never,
      normalized: {
        variant_key: "11:5227002:T>A",
        assembly: "hg19",
        gene: "HBB",
        chrom: "11",
        pos: 5227002,
        ref: "T",
        alt: "A",
        rsid: "rs334",
        clinvar_variation_id: null,
        hgvs_g: "chr11:g.5227002T>A",
        transcript_id: null,
        source: "manual",
      },
      evo2: {
        prediction: "pathogenic",
        classification: "Pathogenic",
        score: 0.9,
        confidence: 0.9,
        delta_score: -2,
        cached: true,
      },
    });

    expect(result.disease_association).toEqual(cachedAssociation);
    expect(gte).toHaveBeenCalledWith("created_at", expect.any(String));
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
