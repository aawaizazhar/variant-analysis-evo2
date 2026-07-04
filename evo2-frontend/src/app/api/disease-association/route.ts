import { NextResponse } from "next/server";

import {
  getDiseaseAssociation,
  isVariantPipelineInput,
  normalizeEvo2Prediction,
  normalizeVariantInput,
  type Evo2Result,
} from "~/lib/snv-pipeline";
import { createPipelineClient } from "~/utils/supabase/admin";
import { createClient } from "~/utils/supabase/server";

type DiseaseAssociationBody = Record<string, unknown> & {
  evo2?: unknown;
};

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
    const body = parsedBody as DiseaseAssociationBody;
    const normalized = normalizeVariantInput(parsedBody);
    const evo2 = parseEvo2Result(body.evo2);
    const pipelineClient = createPipelineClient(supabase);
    const diseaseResult = await getDiseaseAssociation({
      supabase: pipelineClient,
      normalized,
      evo2,
    });

    return NextResponse.json({
      ...diseaseResult,
      evo2,
    });
  } catch (error) {
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

function parseEvo2Result(value: unknown): Evo2Result {
  if (!value || typeof value !== "object") {
    return {
      prediction: "uncertain",
      classification: "Uncertain",
      score: null,
      confidence: null,
      delta_score: null,
      cached: false,
      raw_prediction: null,
    };
  }

  const candidate = value as Record<string, unknown>;
  const score =
    typeof candidate.score === "number" && Number.isFinite(candidate.score)
      ? Math.min(candidate.score, 0.99)
      : null;
  const deltaScore =
    typeof candidate.delta_score === "number" &&
    Number.isFinite(candidate.delta_score)
      ? candidate.delta_score
      : null;

  return {
    prediction: normalizeEvo2Prediction(candidate.prediction),
    classification: formatPrediction(normalizeEvo2Prediction(candidate.prediction)),
    score,
    confidence: score,
    delta_score: deltaScore,
    cached: candidate.cached === true,
    raw_prediction:
      typeof candidate.raw_prediction === "string"
        ? candidate.raw_prediction
        : null,
  };
}

function formatPrediction(prediction: Evo2Result["prediction"]) {
  return prediction
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
