import { describe, expect, it } from "vitest";
import { toCsv } from "./prediction-csv";

describe("historical export ranking policy", () => {
  it.each([
    "benign",
    "likely_benign",
    "uncertain",
    "conflicting classifications",
    null,
  ])(
    "suppresses old rankings for %s while retaining curated evidence",
    (prediction) => {
      const csv = toCsv([
        {
          prediction,
          clinvar_evidence: [{ disease_name: "Curated assertion" }],
          disease_model_ranking: [
            { disease_name: "Misleading candidate", association_score: 0.99 },
          ],
          final_interpretation: {
            level: "strong",
            message: "Outdated interpretation",
          },
        },
      ]);
      expect(csv).toContain("Curated assertion");
      expect(csv).not.toContain("Misleading candidate");
      expect(csv).not.toContain("Outdated interpretation");
      expect(csv).toContain("skipped_");
    },
  );

  it("exports expressly requested VUS research with its warning", () => {
    const csv = toCsv([
      {
        prediction: "uncertain",
        disease_model_ranking: [
          { disease_name: "Research candidate", association_score: 0.1 },
        ],
        final_interpretation: {
          ranking_policy: "exploratory_uncertain",
          ranking_policy_version: 1,
        },
      },
    ]);
    expect(csv).toContain("Research candidate");
    expect(csv).toContain("exploratory_uncertain");
    expect(csv).toContain("not disease-risk probabilities");
  });
});
