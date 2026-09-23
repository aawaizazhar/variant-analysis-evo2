import { NextResponse } from "next/server";
import {
  billingAdmin,
  billingFailure,
  billingRpc,
  billingUser,
  getBillingAccess,
  paddleClient,
} from "~/lib/billing/server";
import { billingConfig, BillingError, paymentsEnabled } from "~/lib/billing/config";
import { syncProviderEntity } from "~/lib/billing/sync";

export const runtime = "nodejs";
export async function GET() {
  if (!paymentsEnabled()) {
    return NextResponse.json(
      { error: "Payments are currently disabled." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const user = await billingUser();
    const access = await getBillingAccess(user.id);
    const price = await paddleClient()
      .prices.get(billingConfig().priceId)
      .catch(() => null);
    return NextResponse.json(
      {
        ...access,
        price: price
          ? {
              amount: price.unitPrice.amount,
              currency: price.unitPrice.currencyCode,
              interval: price.billingCycle?.interval,
              frequency: price.billingCycle?.frequency,
            }
          : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return billingFailure(error);
  }
}

// Explicit, rate-limited recovery for missed webhooks. Always read the provider;
// the browser supplies neither a customer ID nor a desired subscription state.
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
    if (
      !(await billingRpc<boolean>("billing_claim_refresh", { p_user: user.id }))
    ) {
      throw new BillingError(
        "Please wait 30 seconds before refreshing again.",
        429,
      );
    }
    if (access.customerId) {
      const paddle = paddleClient();
      const subscriptions = paddle.subscriptions.list({
        customerId: [access.customerId],
      });
      // Limit work per HTTP request. This app sells one subscription per account.
      const firstPage = await subscriptions.next();
      for (const subscription of firstPage)
        await syncProviderEntity(
          "subscription.updated",
          subscription.id,
          undefined,
          undefined,
          user.id,
        );
      const { data: attempt, error } = await billingAdmin()
        .from("billing_checkouts")
        .select("id,transaction_id")
        .eq("environment", access.environment)
        .eq("user_id", user.id)
        .in("state", ["creating", "ready", "completed"])
        .maybeSingle<{ id: string; transaction_id: string | null }>();
      if (error) throw new BillingError("Could not load pending checkout.");
      if (attempt?.transaction_id)
        await syncProviderEntity(
          "transaction.updated",
          attempt.transaction_id,
          undefined,
          undefined,
          user.id,
        );
      else if (attempt) {
        const recent = await paddle.transactions
          .list({ customerId: [access.customerId] })
          .next();
        const transaction = recent.find(
          (t) => t.customData?.checkout_attempt_id === attempt.id,
        );
        if (transaction)
          await syncProviderEntity(
            "transaction.updated",
            transaction.id,
            undefined,
            undefined,
            user.id,
          );
      }
    }
    return NextResponse.json(
      { refreshed: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return billingFailure(error);
  }
}
