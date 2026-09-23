import {
  authorizeAnalysis,
  analysisAccessFailure,
} from "~/lib/billing/analysis-access";
import { billingAdmin } from "~/lib/billing/server";
import { NextResponse } from "next/server";

import {
  getEvo2ResultWithCache,
  isVariantPipelineInput,
} from "~/lib/snv-pipeline";

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

  let permission: Awaited<ReturnType<typeof authorizeAnalysis>> | undefined;
  try {
    permission = await authorizeAnalysis(user.id, parsedBody, false);
    const pipelineClient = billingAdmin();
    const { normalized, evo2, warnings } = await getEvo2ResultWithCache({
      supabase: pipelineClient,
      input: parsedBody,
    });

    await permission.settle(true);
    return NextResponse.json({
      variant_key: normalized.variant_key,
      gene: normalized.gene,
      normalized_variant: normalized,
      evo2,
      warnings,
    });
  } catch (error) {
    await permission?.settle(false).catch(() => undefined);
    const denied = analysisAccessFailure(error);
    if (denied) return denied;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to run Evo2 prediction",
      },
      { status: 502 },
    );
  }
}
