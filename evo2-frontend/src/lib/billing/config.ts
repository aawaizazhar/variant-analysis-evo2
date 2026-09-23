import { z } from "zod";

export class BillingError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}

export function paymentsEnabled() {
  // Existing payment unit tests remain executable, while deployed builds stay
  // disabled unless an operator explicitly opts in later.
  return process.env.NODE_ENV === "test" || process.env.ENABLE_PAYMENTS === "true";
}

const configuration = z.object({
  environment: z.enum(["sandbox", "live"]),
  publicEnvironment: z.enum(["sandbox", "live"]),
  apiKey: z.string().min(1),
  token: z.string().min(1),
  priceId: z.string().regex(/^pri_[a-z0-9]+$/),
  productId: z.string().regex(/^pro_[a-z0-9]+$/),
  appUrl: z.string().url(),
});

// Lazy validation allows builds before the webhook destination has been created.
// Errors intentionally never contain credential values.
export function billingConfig() {
  const parsed = configuration.safeParse({
    environment: process.env.PADDLE_ENVIRONMENT,
    publicEnvironment: process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT,
    apiKey: process.env.PADDLE_API_KEY,
    token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
    priceId: process.env.PADDLE_RESEARCHER_MONTHLY_PRICE_ID,
    productId: process.env.PADDLE_RESEARCHER_PRODUCT_ID,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success)
    throw new BillingError(
      "Billing configuration is incomplete. Follow BILLING_SETUP.md.",
    );
  const c = parsed.data;
  const sandbox = c.environment === "sandbox";
  const url = new URL(c.appUrl);
  if (
    c.environment !== c.publicEnvironment ||
    sandbox !== c.apiKey.includes("_sdbx_") ||
    sandbox !== c.token.startsWith("test_") ||
    (!sandbox && !c.token.startsWith("live_")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        sandbox &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  ) {
    throw new BillingError(
      "Billing environment or application URL is invalid.",
    );
  }
  return { ...c, appUrl: url.origin };
}

export function webhookSecret() {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret)
    throw new BillingError(
      "The Paddle webhook secret has not been configured.",
    );
  return secret;
}
