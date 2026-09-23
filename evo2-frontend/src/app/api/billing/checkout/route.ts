import { NextResponse } from "next/server";
import { ApiError } from "@paddle/paddle-node-sdk";
import {
  billingConfig,
  BillingError,
  paymentsEnabled,
  webhookSecret,
} from "~/lib/billing/config";
import {
  billingAdmin,
  billingFailure,
  billingRpc,
  billingUser,
  getBillingAccess,
  paddleClient,
} from "~/lib/billing/server";
import { syncProviderEntity } from "~/lib/billing/sync";

export const runtime = "nodejs";
type Attempt = {
  blocked?: boolean;
  new?: boolean;
  id: string;
  transaction_id?: string;
  state: string;
};

// These reject transaction creation before a payable transaction exists.
// Never release on transport errors, server errors, or an unknown outcome.
const rejectedTransactionCodes = new Set([
  "transaction_default_checkout_url_not_set",
  "transaction_checkout_url_domain_is_not_approved",
  "transaction_checkout_not_enabled",
  "transaction_creation_blocked",
  "forbidden",
  "authentication_missing",
  "authentication_malformed",
  "invalid_token",
  "invalid_field",
]);

export async function POST(request: Request) {
  if (!paymentsEnabled()) {
    return NextResponse.json(
      { error: "Payments are currently disabled." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const user = await billingUser(request);
    const c = billingConfig();
    webhookSecret(); // Don't open checkout until its callback can be verified.
    const access = await getBillingAccess(user.id);
    if (
      access.subscriptionId &&
      ["active", "trialing", "past_due", "paused"].includes(access.status)
    ) {
      throw new BillingError(
        "You already have a subscription. Use Manage subscription.",
        409,
      );
    }
    const paddle = paddleClient();
    // Validate the actual catalog before claiming an attempt.
    const price = await paddle.prices.get(c.priceId);
    if (
      price.productId !== c.productId ||
      price.status !== "active" ||
      !price.billingCycle ||
      price.trialPeriod
    ) {
      throw new BillingError(
        "Researcher requires an active recurring price without a trial.",
      );
    }
    const attempt = await billingRpc<Attempt>("billing_begin_checkout", {
      p_user: user.id,
      p_environment: c.environment,
    });
    if (attempt.blocked)
      throw new BillingError(
        "You already have a subscription. Use Manage subscription.",
        409,
      );
    if (!attempt.new) {
      if (!attempt.transaction_id)
        throw new BillingError(
          "Your checkout is being prepared. If this persists, contact support before starting another purchase.",
          409,
        );
      const t = await paddle.transactions.get(attempt.transaction_id);
      if (t.customerId !== access.customerId)
        throw new BillingError(
          "Checkout ownership could not be verified.",
          403,
        );
      await syncProviderEntity(
        "transaction.updated",
        t.id,
        undefined,
        undefined,
        user.id,
      );
      if (!["draft", "ready"].includes(t.status))
        throw new BillingError(
          "This checkout has finished. Refresh your subscription status before retrying.",
          409,
        );
      return NextResponse.json(
        { transactionId: t.id },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    let customerId = access.customerId;
    if (!customerId) {
      if (!user.email)
        throw new BillingError("An account email is required.", 400);
      const customer = await paddle.customers.create({
        email: user.email,
        customData: { user_id: user.id },
      });
      const { error } = await billingAdmin()
        .from("billing_customers")
        .insert({
          environment: c.environment,
          user_id: user.id,
          customer_id: customer.id,
        });
      if (error)
        throw new BillingError(
          "Could not store your billing account. Contact support before retrying.",
        );
      customerId = customer.id;
    }
    const transaction = await paddle.transactions.create({
      items: [{ priceId: c.priceId, quantity: 1 }],
      customerId,
      collectionMode: "automatic",
      customData: { user_id: user.id, checkout_attempt_id: attempt.id },
      // Use Paddle's configured default payment link. An explicit override
      // undergoes separate domain approval checks, including in sandbox.
    }).catch(async (error: unknown) => {
      if (error instanceof ApiError && rejectedTransactionCodes.has(error.code)) {
        const { error: releaseError } = await billingAdmin()
          .from("billing_checkouts")
          .update({ state: "canceled" })
          .eq("id", attempt.id)
          .eq("state", "creating")
          .is("transaction_id", null);
        if (releaseError)
          throw new BillingError(
            "Paddle rejected checkout, but the failed attempt could not be released. Contact support before retrying.",
          );
      }
      throw error;
    });
    // A timeout never releases the attempt automatically: an external transaction may exist.
    const { error } = await billingAdmin()
      .from("billing_checkouts")
      .update({ transaction_id: transaction.id, state: "ready" })
      .eq("id", attempt.id)
      .eq("state", "creating");
    if (error)
      throw new BillingError(
        "Checkout was created but could not be confirmed. Please retry shortly.",
      );
    return NextResponse.json(
      { transactionId: transaction.id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return billingFailure(error);
  }
}
