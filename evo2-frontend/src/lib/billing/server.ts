import { ApiError, Environment, Paddle } from "@paddle/paddle-node-sdk";
import { NextResponse } from "next/server";
import { createAdminClient } from "~/utils/supabase/admin";
import { createClient } from "~/utils/supabase/server";
import { billingConfig, BillingError } from "./config";
import type { PlanType } from "~/lib/plans";

export function billingAdmin() {
  const admin = createAdminClient();
  if (!admin)
    throw new BillingError("Server billing database credentials are missing.");
  return admin;
}

export function paddleClient() {
  const config = billingConfig();
  return new Paddle(config.apiKey, {
    environment:
      config.environment === "sandbox"
        ? Environment.sandbox
        : Environment.production,
  });
}

export async function billingRpc<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const result = await billingAdmin().rpc(name, args);
  if (result.error) {
    if (
      result.error.code === "PGRST202" &&
      ["reserve_free_analysis", "settle_free_analysis"].includes(name)
    ) {
      throw new BillingError(
        "Free-access database setup is missing. Apply supabase/free-access.sql in the Supabase SQL Editor.",
      );
    }
    // Do not echo provider payloads or database details to the browser or logs.
    throw new BillingError(
      "Billing database is unavailable or its configuration does not match. Check the migration and server settings.",
    );
  }
  return result.data as T;
}

export type BillingAccess = {
  plan: PlanType;
  status: string;
  subscriptionId: string | null;
  customerId: string | null;
  periodEnd: string | null;
  scheduledChange: { action: string; effective_at: string } | null;
  environment: "sandbox" | "live";
};

export async function getBillingAccess(userId: string): Promise<BillingAccess> {
  const c = billingConfig();
  return billingRpc("billing_access", {
    p_user: userId,
    p_environment: c.environment,
    p_price: c.priceId,
    p_product: c.productId,
  });
}

export async function billingUser(request?: Request) {
  // Require same-origin POSTs; webhooks use signatures and never call this helper.
  if (request && request.headers.get("origin") !== billingConfig().appUrl) {
    throw new BillingError("Request origin is not allowed.", 403);
  }
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new BillingError("Unauthorized", 401);
  return user;
}

export function billingFailure(error: unknown) {
  let message = "Billing request failed. Please retry shortly.";
  if (error instanceof BillingError) message = error.message;
  else if (error instanceof ApiError) {
    // Provider detail/errors may contain customer data or request values.
    // Expose only a bounded machine code, never the raw error or payload.
    const code = /^[a-z][a-z0-9_]{0,99}$/.test(error.code)
      ? error.code
      : "unknown_provider_error";
    if (code === "transaction_default_checkout_url_not_set") {
      message =
        "Paddle checkout is not configured: set the Default payment link in Paddle Checkout settings. (transaction_default_checkout_url_not_set)";
    } else {
      message = `Paddle could not complete the billing request (${code}). Check the Paddle configuration before retrying.`;
    }
  }
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: error instanceof BillingError ? error.status : 502,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
