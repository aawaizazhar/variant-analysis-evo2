import { NextResponse } from "next/server";
import { z } from "zod";
import { billingConfig, paymentsEnabled, webhookSecret } from "~/lib/billing/config";
import {
  billingAdmin,
  billingFailure,
  paddleClient,
} from "~/lib/billing/server";
import { syncProviderEntity } from "~/lib/billing/sync";

export const runtime = "nodejs";
const envelope = z.object({
  event_id: z.string().startsWith("evt_"),
  event_type: z.string(),
  occurred_at: z.string().datetime({ offset: true }),
  data: z.object({ id: z.string().min(1) }),
});

export async function POST(request: Request) {
  if (!paymentsEnabled()) {
    return NextResponse.json(
      { error: "Payments are currently disabled." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const config = billingConfig();
    const secret = webhookSecret();
    const raw = await request.text();
    if (raw.length > 1_000_000)
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    try {
      await paddleClient().webhooks.unmarshal(
        raw,
        secret,
        request.headers.get("paddle-signature") ?? "",
      );
    } catch {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 },
      );
    }
    const parsed = envelope.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    const e = parsed.data;
    const { data: seen, error } = await billingAdmin()
      .from("billing_events")
      .select("event_id")
      .eq("environment", config.environment)
      .eq("event_id", e.event_id)
      .maybeSingle();
    if (error) throw new Error("Event ledger unavailable");
    if (!seen)
      await syncProviderEntity(
        e.event_type,
        e.data.id,
        e.event_id,
        e.occurred_at,
      );
    return NextResponse.json({ received: true });
  } catch (error) {
    return billingFailure(error);
  }
}
