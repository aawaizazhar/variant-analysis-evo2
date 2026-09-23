import type { PlanType } from "~/lib/plans";

/**
 * Payments are intentionally disabled for the initial public launch.
 * Every authenticated user receives the existing Researcher feature set.
 */
export const ACTIVE_ACCESS_PLAN: PlanType = "researcher";
export const ACTIVE_ACCESS_LABEL = "Free access";

