import { NextResponse } from "next/server";
import { BillingError, paymentsEnabled } from "~/lib/billing/config";
import {
  billingFailure,
  billingUser,
  getBillingAccess,
  paddleClient,
} from "~/lib/billing/server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!paymentsEnabled()) {
    return NextResponse.json(
      { error: "Payments are currently disabled." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const user = await billingUser(request);
    const access = await getBillingAccess(user.id);
    if (!access.customerId)
      throw new BillingError("No billing account exists yet.", 404);
    const session = await paddleClient().customerPortalSessions.create(
      access.customerId,
      access.subscriptionId ? [access.subscriptionId] : [],
    );
    return NextResponse.json(
      { url: session.urls.general.overview },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return billingFailure(error);
  }
}
