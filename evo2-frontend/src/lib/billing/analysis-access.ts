import { NextResponse } from "next/server";
import {
  getPlanLimits,
} from "~/lib/plans";
import { ACTIVE_ACCESS_PLAN } from "~/lib/app-access";
import {
  normalizeVariantInput,
  type VariantPipelineInput,
} from "~/lib/snv-pipeline";
import { BillingError } from "./config";
import { billingRpc } from "./server";

export async function authorizeAnalysis(
  userId: string,
  input: VariantPipelineInput,
  diseaseOnly = false,
) {
  const normalized = normalizeVariantInput(input);
  const limits = getPlanLimits(ACTIVE_ACCESS_PLAN);
  if (diseaseOnly && !limits.diseaseAssociation)
    throw new BillingError(
      "Disease association is available on the Researcher plan.",
      403,
    );
  const reservation = await billingRpc<{
    id?: string;
    exceeded?: boolean;
    busy?: boolean;
  }>("reserve_free_analysis", {
    p_user: userId,
    p_key: `${normalized.assembly}:${normalized.variant_key}`,
    p_limit: limits.dailyPredictions,
  });
  if (reservation.exceeded)
    throw new BillingError(
      `Daily quota of ${limits.dailyPredictions} analyses exceeded. It resets at midnight UTC.`,
      429,
    );
  if (reservation.busy)
    throw new BillingError(
      "This variant is already being analyzed. Please retry shortly.",
      409,
    );
  return {
    allowDisease: limits.diseaseAssociation,
    async settle(success: boolean) {
      if (reservation.id)
        await billingRpc("settle_free_analysis", {
          p_user: userId,
          p_id: reservation.id,
          p_success: success,
        });
    },
  };
}

export function analysisAccessFailure(error: unknown) {
  if (error instanceof BillingError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  return null;
}
