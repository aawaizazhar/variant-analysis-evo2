export type RankingPolicy =
  | "skipped_benign"
  | "skipped_uncertain"
  | "exploratory_uncertain"
  | "exploratory";

export const RESEARCH_WARNING =
  "Research hypotheses only. Rankings do not establish that this variant causes a listed disease, resolve uncertain significance, or guide clinical decisions. Scores are not disease-risk probabilities.";

export function normalizePrediction(value: unknown) {
  const label =
    typeof value === "string"
      ? value
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_")
      : "";
  switch (label) {
    case "pathogenic":
    case "likely_pathogenic":
    case "benign":
    case "likely_benign":
      return label;
    default:
      return "uncertain";
  }
}

export function diseaseRankingPolicy(
  prediction: unknown,
  explore = false,
): RankingPolicy {
  const label = normalizePrediction(prediction);
  if (label === "benign" || label === "likely_benign") return "skipped_benign";
  if (label === "uncertain")
    return explore ? "exploratory_uncertain" : "skipped_uncertain";
  return "exploratory";
}

export function rankingPolicyMessage(
  policy: RankingPolicy,
  prediction: unknown,
) {
  if (policy === "skipped_benign") {
    const label = normalizePrediction(prediction).replaceAll("_", " ");
    return `Evo2 predicts this variant to be ${label}. Automatic ML disease ranking was skipped. This computational prediction is not a clinical classification. Available curated evidence is shown separately.`;
  }
  if (policy === "skipped_uncertain") {
    return "The significance of this variant is uncertain. ML disease ranking was not performed. You may explicitly explore research hypotheses; these cannot resolve the classification.";
  }
  return RESEARCH_WARNING;
}

/** Historical rankings predate gating; never infer VUS opt-in from their presence. */
export function historicalRankingPolicy(
  prediction: unknown,
  interpretation: unknown,
) {
  let metadata = interpretation;
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata) as unknown;
    } catch {
      metadata = null;
    }
  }
  const optedIn =
    !!metadata &&
    typeof metadata === "object" &&
    "ranking_policy" in metadata &&
    metadata.ranking_policy === "exploratory_uncertain" &&
    "ranking_policy_version" in metadata &&
    metadata.ranking_policy_version === 1;
  return diseaseRankingPolicy(prediction, optedIn);
}
