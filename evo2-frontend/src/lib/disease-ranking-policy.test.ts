import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDiseaseAssociation,
  normalizeVariantInput,
  type Evo2Prediction,
  type Evo2Result,
  finalInterpretation,
} from "./snv-pipeline";
import {
  historicalRankingPolicy,
  normalizePrediction,
} from "./disease-ranking-policy";

const normalized = normalizeVariantInput({
  variant_position: 100,
  reference: "A",
  alternative: "G",
  genome: "hg38",
  chromosome: "1",
  gene: "TEST",
});
const evidence = {
  disease_name: "Curated condition",
  clinical_significance: "Pathogenic",
  sig_group: "pathogenic",
  source: "ClinVar",
  review_status: "reviewed by expert panel",
};

function setup(
  prediction: Evo2Prediction,
  supported = true,
  failSupport = false,
) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const cacheInsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table === "analysis_result_cache") {
      const cacheQuery = {
        eq: () => cacheQuery,
        gte: () => cacheQuery,
        order: () => cacheQuery,
        limit: () => cacheQuery,
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return { insert: cacheInsert, select: () => cacheQuery };
    }
    return {
      insert,
      select: (_columns: string, options?: { head?: boolean }) => {
      const result = options?.head
        ? {
            count: supported ? 1 : 0,
            error: failSupport ? { message: "offline" } : null,
          }
        : { data: [evidence], error: null };
      const query = {
        eq: () => query,
        in: () => query,
        limit: async () => result,
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(result).then(resolve),
      };
      return query;
      },
    };
  });
  const fetch = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        ranking: [
          { disease_name: "Research candidate", association_score: 0.001 },
        ],
      }),
    });
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("DISEASE_MODEL_ENDPOINT_URL", "https://example.test/rank");
  vi.stubEnv("MODAL_API_KEY", "test");
  const evo2: Evo2Result = {
    prediction,
    classification: prediction,
    confidence: null,
    score: null,
    delta_score: null,
    cached: true,
  };
  return { supabase: { from } as never, evo2, fetch, insert };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("classification gate", () => {
  it.each(["benign", "likely_benign"] as const)(
    "skips %s even with opt-in and preserves contradictory evidence",
    async (prediction) => {
      const stub = setup(prediction);
      const result = await getDiseaseAssociation({
        ...stub,
        normalized,
        explore: true,
      });
      expect(result.disease_association.status).toBe("skipped_benign");
      expect(result.clinvar_evidence[0]?.disease_name).toBe(
        evidence.disease_name,
      );
      expect(result.final_interpretation?.level).toBe("conflicting");
      expect(result.disease_model_ranking).toEqual([]);
      expect(stub.fetch).not.toHaveBeenCalled();
      expect(stub.insert).not.toHaveBeenCalled();
    },
  );

  it("does not run uncertain predictions without explicit opt-in", async () => {
    const stub = setup("uncertain");
    const result = await getDiseaseAssociation({ ...stub, normalized });
    expect(result.disease_association.status).toBe("skipped_uncertain");
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it("runs explicitly requested uncertain exploration and persists its policy", async () => {
    const stub = setup("uncertain");
    const result = await getDiseaseAssociation({
      ...stub,
      normalized,
      explore: true,
    });
    expect(result.disease_association.status).toBe("exploratory_uncertain");
    expect(result.final_interpretation).toMatchObject({
      level: "insufficient",
      ranking_policy: "exploratory_uncertain",
      ranking_policy_version: 1,
    });
    expect(stub.fetch).toHaveBeenCalledOnce();
  });

  it.each(["pathogenic", "likely_pathogenic"] as const)(
    "retains automatic ranking for %s, including low scores",
    async (prediction) => {
      const stub = setup(prediction);
      const result = await getDiseaseAssociation({ ...stub, normalized });
      expect(stub.fetch).toHaveBeenCalledOnce();
      expect(result.disease_model_ranking[0]?.association_score).toBe(0.001);
      expect(result.final_interpretation?.ranking_policy).toBe("exploratory");
    },
  );

  it.each([false, true])(
    "retains evidence when gene support is unavailable (error: %s)",
    async (fail) => {
      const stub = setup("pathogenic", false, fail);
      const result = await getDiseaseAssociation({ ...stub, normalized });
      expect(result.clinvar_evidence).toHaveLength(1);
      expect(stub.fetch).not.toHaveBeenCalled();
    },
  );

  it("does not infer historical VUS consent from existing rankings", () => {
    expect(historicalRankingPolicy("VUS", { level: "strong" })).toBe(
      "skipped_uncertain",
    );
    expect(
      historicalRankingPolicy("VUS", {
        ranking_policy: "exploratory_uncertain",
        ranking_policy_version: 1,
      }),
    ).toBe("exploratory_uncertain");
    expect(
      historicalRankingPolicy("Benign", {
        ranking_policy: "exploratory_uncertain",
        ranking_policy_version: 1,
      }),
    ).toBe("skipped_benign");
  });

  it.each([
    "conflicting pathogenic/benign",
    "not pathogenic",
    "uncertain pathogenicity",
    null,
  ])("treats ambiguous label %s as uncertain", (label) => {
    expect(normalizePrediction(label)).toBe("uncertain");
  });

  it("does not call a benign ClinVar match strong pathogenic evidence", () => {
    expect(
      finalInterpretation({
        evo2Prediction: "pathogenic",
        evo2Score: 0.9,
        exactClinvarFound: true,
        exactClinvarSigGroup: "benign",
        topDiseaseScore: 0.99,
      }).level,
    ).toBe("conflicting");
  });
});
