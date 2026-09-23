import { z } from "zod";
import { billingConfig } from "./config";

const priceSchema = z.object({
  data: z.object({
    id: z.string(),
    product_id: z.string(),
    status: z.literal("active"),
    unit_price: z.object({
      amount: z.string().regex(/^\d+$/),
      currency_code: z.string().length(3),
    }),
    billing_cycle: z.object({
      interval: z.literal("month"),
      frequency: z.literal(1),
    }),
    trial_period: z.null(),
  }),
});

// Server use only. The public page receives display text, never credentials,
// customer information, or provider response bodies. No transactions are made.
export async function getPublicResearcherPrice() {
  try {
    const c = billingConfig();
    const host =
      c.environment === "sandbox" ? "sandbox-api.paddle.com" : "api.paddle.com";
    const response = await fetch(`https://${host}/prices/${c.priceId}`, {
      headers: { Authorization: `Bearer ${c.apiKey}`, "Paddle-Version": "1" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const parsed = priceSchema.safeParse(await response.json());
    if (!parsed.success) return null;
    const price = parsed.data.data;
    if (price.id !== c.priceId || price.product_id !== c.productId) return null;
    const format = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: price.unit_price.currency_code,
    });
    const amount = Number(price.unit_price.amount);
    if (!Number.isSafeInteger(amount)) return null;
    return {
      label: format.format(
        amount / 10 ** (format.resolvedOptions().maximumFractionDigits ?? 2),
      ),
      currency: price.unit_price.currency_code,
      sandbox: c.environment === "sandbox",
    };
  } catch {
    return null;
  }
}
