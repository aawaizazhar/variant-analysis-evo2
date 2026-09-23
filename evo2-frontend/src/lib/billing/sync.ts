import type {
  Subscription,
  Transaction,
  Adjustment,
} from "@paddle/paddle-node-sdk";
import { billingConfig, BillingError } from "./config";
import { billingAdmin, billingRpc, paddleClient } from "./server";

export function subscriptionSnapshot(
  s: Subscription,
  priceId: string,
  productId: string,
) {
  const item = s.items[0];
  return {
    id: s.id,
    status: s.status,
    updated_at: s.updatedAt,
    price_id: item?.price.id ?? null,
    product_id: item?.price.productId ?? null,
    eligible:
      s.items.length === 1 &&
      item?.quantity === 1 &&
      item.recurring &&
      item.price.id === priceId &&
      item.price.productId === productId,
    period_end: s.currentBillingPeriod?.endsAt ?? null,
    scheduled_change: s.scheduledChange
      ? {
          action: s.scheduledChange.action,
          effective_at: s.scheduledChange.effectiveAt,
        }
      : null,
  };
}

export function transactionSnapshot(t: Transaction) {
  const attempt: unknown = t.customData?.checkout_attempt_id;
  return {
    id: t.id,
    status: t.status,
    subscription_id: t.subscriptionId,
    amount: t.details?.totals?.total ?? null,
    currency: t.currencyCode,
    updated_at: t.updatedAt,
    attempt_id: typeof attempt === "string" ? attempt : null,
  };
}

export async function syncEntities({
  eventId,
  eventType,
  occurredAt,
  subscription,
  transaction,
  adjustment,
  expectedUserId,
}: {
  eventId: string;
  eventType: string;
  occurredAt: string;
  subscription?: Subscription;
  transaction?: Transaction;
  adjustment?: Adjustment;
  expectedUserId?: string;
}) {
  const c = billingConfig();
  const customerId =
    subscription?.customerId ??
    transaction?.customerId ??
    adjustment?.customerId;
  if (
    !customerId ||
    [
      subscription?.customerId,
      transaction?.customerId,
      adjustment?.customerId,
    ].some((id) => id && id !== customerId)
  ) {
    throw new BillingError("Billing customer mapping is inconsistent.");
  }
  const { data: customer, error } = await billingAdmin()
    .from("billing_customers")
    .select("user_id")
    .eq("environment", c.environment)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) throw new BillingError("Could not verify billing ownership.");
  // Ignore unrelated dashboard/test purchases. Never associate accounts by email or browser metadata.
  if (!customer) {
    if (expectedUserId)
      throw new BillingError(
        "Subscription ownership could not be verified.",
        403,
      );
    return;
  }
  if (expectedUserId && customer.user_id !== expectedUserId)
    throw new BillingError("Forbidden", 403);
  await billingRpc("billing_apply_event", {
    p_environment: c.environment,
    p_event_id: eventId,
    p_event_type: eventType,
    p_occurred_at: occurredAt,
    p_customer_id: customerId,
    p_subscription: subscription
      ? subscriptionSnapshot(subscription, c.priceId, c.productId)
      : null,
    p_transaction: transaction ? transactionSnapshot(transaction) : null,
    p_adjustment: adjustment
      ? {
          id: adjustment.id,
          transaction_id: adjustment.transactionId,
          status: adjustment.status,
          action: adjustment.action,
          amount: adjustment.totals.total,
          updated_at: adjustment.updatedAt,
        }
      : null,
  });
}

// Fetch authoritative snapshots instead of allowing a stale or synthetic event to grant access.
export async function syncProviderEntity(
  type: string,
  id: string,
  eventId?: string,
  occurredAt?: string,
  expectedUserId?: string,
) {
  const paddle = paddleClient();
  let transaction: Transaction | undefined;
  let subscription: Subscription | undefined;
  let adjustment: Adjustment | undefined;
  if (type.startsWith("subscription."))
    subscription = await paddle.subscriptions.get(id);
  else if (type.startsWith("transaction.")) {
    transaction = await paddle.transactions.get(id);
    if (transaction.subscriptionId)
      subscription = await paddle.subscriptions.get(transaction.subscriptionId);
  } else if (type.startsWith("adjustment.")) {
    adjustment = (await paddle.adjustments.list({ id: [id] }).next())[0];
    if (!adjustment)
      throw new BillingError("Adjustment could not be verified.");
    transaction = await paddle.transactions.get(adjustment.transactionId);
    if (transaction.subscriptionId)
      subscription = await paddle.subscriptions.get(transaction.subscriptionId);
  } else return;
  const stamp = [
    subscription?.updatedAt,
    transaction?.updatedAt,
    adjustment?.updatedAt,
  ]
    .filter(Boolean)
    .join(":");
  await syncEntities({
    subscription,
    transaction,
    adjustment,
    expectedUserId,
    eventType: type,
    eventId: eventId ?? `reconcile:${id}:${stamp}`,
    occurredAt: occurredAt ?? new Date().toISOString(),
  });
}
