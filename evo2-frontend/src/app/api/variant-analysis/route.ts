import { NextResponse } from "next/server";

import {
  isVariantPipelineInput,
  persistAnalysisHistory,
  runVariantAnalysis,
} from "~/lib/snv-pipeline";
import {
  formatAllowedGenomes,
  getPlanLimits,
  isGenomeAllowedForPlan,
  normalizePlanType,
} from "~/lib/plans";
import { createPipelineClient } from "~/utils/supabase/admin";
import { createClient } from "~/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isVariantPipelineInput(parsedBody)) {
    return NextResponse.json(
      {
        error:
          "Missing or invalid required fields: variant_position, reference, alternative, genome, chromosome",
      },
      { status: 400 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan_type")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load plan for variant analysis:", profileError.message);
  }

  const planType = normalizePlanType(profile?.plan_type);
  const planLimits = getPlanLimits(planType);

  if (!isGenomeAllowedForPlan(planType, parsedBody.genome)) {
    return NextResponse.json(
      {
        error: `${planType === "student" ? "Student" : "Researcher"} plan supports ${formatAllowedGenomes(planType).toLowerCase()} for analysis.`,
      },
      { status: 403 },
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error: countError } = await supabase
    .from("prediction_history")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", today.toISOString());

  if (countError) {
    console.error("Failed to check daily quota:", countError.message);
    return NextResponse.json(
      { error: "Could not verify your daily prediction quota." },
      { status: 500 },
    );
  }

  if (count !== null && count >= planLimits.dailyPredictions) {
    return NextResponse.json(
      {
        error: `Daily quota of ${planLimits.dailyPredictions} analyses exceeded for your ${planType} plan. Please try again tomorrow.`,
      },
      { status: 429 },
    );
  }

  try {
    const pipelineClient = createPipelineClient(supabase);
    const result = await runVariantAnalysis({
      supabase: pipelineClient,
      input: parsedBody,
    });

    await persistAnalysisHistory({
      supabase: pipelineClient,
      userId: user.id,
      result,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Variant analysis failed";
    const status = isVariantInputError(message) ? 400 : 502;

    return NextResponse.json({ error: message }, { status });
  }
}

function isVariantInputError(message: string) {
  return (
    message.includes("Only single nucleotide") ||
    message.includes("Alternative base must be different") ||
    message.includes("Variant position must be a positive integer") ||
    message.includes("Chromosome is required")
  );
}
