import {
  authorizeAnalysis,
  analysisAccessFailure,
} from "~/lib/billing/analysis-access";
import { billingAdmin } from "~/lib/billing/server";
import { NextResponse } from "next/server";

import {
  isVariantPipelineInput,
  persistAnalysisHistory,
  runVariantAnalysis,
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
    const result = await runVariantAnalysis({
      supabase: pipelineClient,
      input: parsedBody,
      allowDisease: permission.allowDisease,
    });

    await persistAnalysisHistory({
      supabase: pipelineClient,
      userId: user.id,
      result,
    });

    await permission.settle(true);
    return NextResponse.json(result);
  } catch (error) {
    await permission?.settle(false).catch(() => undefined);
    const denied = analysisAccessFailure(error);
    if (denied) return denied;
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
