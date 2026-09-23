import { z } from "zod";

export const accessSummarySchema = z.object({
  plan: z.enum(["student", "researcher"]),
  status: z.string(),
});

export const billingStatusSchema = accessSummarySchema.extend({
  subscriptionId: z.string().nullable(),
  customerId: z.string().nullable(),
  periodEnd: z.string().nullable(),
  scheduledChange: z
    .object({ action: z.string(), effective_at: z.string() })
    .nullable(),
  environment: z.enum(["sandbox", "live"]),
  price: z
    .object({
      amount: z.string().regex(/^\d+$/),
      currency: z.string().length(3),
      interval: z.string().optional(),
      frequency: z.number().positive().optional(),
    })
    .nullable(),
});

export const checkoutResponseSchema = z.object({
  transactionId: z.string().regex(/^txn_[a-z0-9]+$/),
});
export const portalResponseSchema = z.object({
  url: z.string().url().startsWith("https://"),
});
export const refreshResponseSchema = z.object({ refreshed: z.boolean() });
