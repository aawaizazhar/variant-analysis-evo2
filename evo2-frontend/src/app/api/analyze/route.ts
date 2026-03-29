import { NextRequest, NextResponse } from "next/server";
import { createClient } from "~/utils/supabase/server";

// Simple in-memory rate limiter: max 10 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Rate limiting
  const ip =
    (req as NextRequest).headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  // Parse and validate the request body
  let body: {
    variant_position: number;
    alternative: string;
    genome: string;
    chromosome: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { variant_position, alternative, genome, chromosome } = body;

  if (
    typeof variant_position !== "number" ||
    typeof alternative !== "string" ||
    typeof genome !== "string" ||
    typeof chromosome !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing or invalid required fields: variant_position (number), alternative (string), genome (string), chromosome (string)" },
      { status: 400 },
    );
  }

  // Read server-only secrets
  const modalUrl = process.env.MODAL_ENDPOINT_URL;
  const modalApiKey = process.env.MODAL_API_KEY;

  if (!modalUrl || !modalApiKey) {
    console.error("Missing MODAL_ENDPOINT_URL or MODAL_API_KEY environment variables");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  // Forward request to Modal with the API key
  try {
    const modalResponse = await fetch(modalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": modalApiKey,
      },
      body: JSON.stringify({
        variant_position,
        alternative,
        genome,
        chromosome,
      }),
    });

    if (!modalResponse.ok) {
      const errorText = await modalResponse.text();
      console.error(`Modal API error (${modalResponse.status}): ${errorText}`);
      return NextResponse.json(
        { error: "Analysis service error" },
        { status: modalResponse.status },
      );
    }

    const result = await modalResponse.json();

    // Log to Supabase if user is logged in
    if (user) {
      const { error: dbError } = await supabase.from('prediction_history').insert({
        user_id: user.id,
        variant_position: variant_position,
        alternative: alternative,
        genome_assembly: genome,
        chromosome: chromosome,
        prediction: result.prediction,
        delta_score: result.delta_score,
        confidence: result.classification_confidence,
      });

      if (dbError) {
        console.error("Failed to log history to Supabase:", dbError.message);
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to reach Modal endpoint:", err);
    return NextResponse.json(
      { error: "Failed to connect to analysis service" },
      { status: 502 },
    );
  }
}
