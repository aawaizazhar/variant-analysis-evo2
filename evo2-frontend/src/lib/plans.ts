const ALL_GENOMES = "*";

export const PLAN_LIMITS = {
  student: {
    dailyPredictions: 5,
    allowedGenomes: ["hg38"],
    csvExport: false,
    predictionHistory: false,
    diseaseAssociation: false,
  },
  researcher: {
    dailyPredictions: 50,
    allowedGenomes: [ALL_GENOMES],
    csvExport: true,
    predictionHistory: true,
    diseaseAssociation: true,
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PLAN_TYPES = Object.keys(PLAN_LIMITS) as PlanType[];
export const SUBSCRIPTION_STATUSES = [
  "inactive",
  "active",
  "trialing",
  "past_due",
  "paused",
  "canceled",
] as const;

export function normalizePlanType(planType: unknown): PlanType {
  return planType === "researcher" ? "researcher" : "student";
}

export function normalizeSubscriptionStatus(
  status: unknown,
): SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly unknown[]).includes(status)
    ? (status as SubscriptionStatus)
    : "inactive";
}

export function getPlanLimits(planType: unknown) {
  return PLAN_LIMITS[normalizePlanType(planType)];
}

export function planAllowsAllGenomes(planType: unknown) {
  return (getPlanLimits(planType).allowedGenomes as readonly string[]).includes(
    ALL_GENOMES,
  );
}

export function isGenomeAllowedForPlan(planType: unknown, genome: string) {
  const allowedGenomes = getPlanLimits(planType)
    .allowedGenomes as readonly string[];

  return (
    allowedGenomes.includes(ALL_GENOMES) || allowedGenomes.includes(genome)
  );
}

export function formatAllowedGenomes(planType: unknown) {
  if (planAllowsAllGenomes(planType)) {
    return "All available human assemblies";
  }

  return getPlanLimits(planType).allowedGenomes.join(", ");
}

export function formatPlanName(planType: unknown) {
  const normalizedPlanType = normalizePlanType(planType);

  return normalizedPlanType === "researcher" ? "Researcher" : "Student";
}
