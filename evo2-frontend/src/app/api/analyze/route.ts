import { NextResponse } from "next/server";

import {
  getEvo2ResultWithCache,
  isVariantPipelineInput,
  type Evo2Prediction,
} from "~/lib/snv-pipeline";
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

  try {
    const pipelineClient = createPipelineClient(supabase);
    const { normalized, evo2 } = await getEvo2ResultWithCache({
      supabase: pipelineClient,
      input: parsedBody,
    });

    return NextResponse.json({
      position: normalized.pos,
      reference: normalized.ref,
      alternative: normalized.alt,
      delta_score: evo2.delta_score ?? 0,
      prediction: toLegacyPredictionLabel(evo2.prediction),
      classification_confidence: evo2.score ?? 0,
      variant_key: normalized.variant_key,
      cached: evo2.cached,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to analyze variant",
      },
      { status: 502 },
    );
  }
}

function toLegacyPredictionLabel(prediction: Evo2Prediction) {
  switch (prediction) {
    case "pathogenic":
      return "Pathogenic";
    case "likely_pathogenic":
      return "Likely pathogenic";
    case "likely_benign":
      return "Likely benign";
    case "benign":
      return "Benign";
    case "uncertain":
      return "Uncertain";
  }
}
