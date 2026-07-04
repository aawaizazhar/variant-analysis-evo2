import { NextResponse } from "next/server";

import {
  getEvo2ResultWithCache,
  isVariantPipelineInput,
} from "~/lib/snv-pipeline";
import {
  formatAllowedGenomes,
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_type")
    .eq("id", user.id)
    .maybeSingle();
  const planType = normalizePlanType(profile?.plan_type);

  if (!isGenomeAllowedForPlan(planType, parsedBody.genome)) {
    return NextResponse.json(
      {
        error: `${planType === "student" ? "Student" : "Researcher"} plan supports ${formatAllowedGenomes(planType).toLowerCase()} for analysis.`,
      },
      { status: 403 },
    );
  }

  try {
    const pipelineClient = createPipelineClient(supabase);
    const { normalized, evo2, warnings } = await getEvo2ResultWithCache({
      supabase: pipelineClient,
      input: parsedBody,
    });

    return NextResponse.json({
      variant_key: normalized.variant_key,
      gene: normalized.gene,
      normalized_variant: normalized,
      evo2,
      warnings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to run Evo2 prediction",
      },
      { status: 502 },
    );
  }
}
