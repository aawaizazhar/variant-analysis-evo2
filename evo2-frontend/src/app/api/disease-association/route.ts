import {
  authorizeAnalysis,
  analysisAccessFailure,
} from "~/lib/billing/analysis-access";
import { billingAdmin } from "~/lib/billing/server";
import { NextResponse } from "next/server";

import {
  getDiseaseAssociation,
  isVariantPipelineInput,
  getEvo2ResultWithCache,
  persistAnalysisHistory,
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
    permission = await authorizeAnalysis(user.id, parsedBody, true);
    const pipelineClient = billingAdmin();
    const { normalized, evo2 } = await getEvo2ResultWithCache({
      supabase: pipelineClient,
      input: parsedBody,
    });
    const diseaseResult = await getDiseaseAssociation({
      supabase: pipelineClient,
      normalized,
      evo2,
      explore: parsedBody.explore_disease_associations === true,
    });

    await persistAnalysisHistory({
      supabase: pipelineClient,
      userId: user.id,
      result: { ...diseaseResult, evo2 },
    });
    await permission.settle(true);
    return NextResponse.json({
      ...diseaseResult,
      evo2,
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
            : "Failed to predict disease association",
      },
      { status: 500 },
    );
  }
}
