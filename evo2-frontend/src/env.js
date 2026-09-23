import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    MODAL_ENDPOINT_URL: z.string().url(),
    DISEASE_MODEL_ENDPOINT_URL: z.string().url(),
    MODAL_API_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    ENABLE_PAYMENTS: z.enum(["true", "false"]).optional(),
    PADDLE_ENVIRONMENT: z.enum(["sandbox", "live"]).optional(),
    PADDLE_API_KEY: z.string().min(1).optional(),
    PADDLE_WEBHOOK_SECRET: z.string().min(1).optional(),
    PADDLE_RESEARCHER_MONTHLY_PRICE_ID: z
      .string()
      .startsWith("pri_")
      .optional(),
    PADDLE_RESEARCHER_PRODUCT_ID: z.string().startsWith("pro_").optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_PADDLE_ENVIRONMENT: z.enum(["sandbox", "live"]).optional(),
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: z.string().min(1).optional(),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    MODAL_ENDPOINT_URL: process.env.MODAL_ENDPOINT_URL,
    DISEASE_MODEL_ENDPOINT_URL: process.env.DISEASE_MODEL_ENDPOINT_URL,
    MODAL_API_KEY: process.env.MODAL_API_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ENABLE_PAYMENTS: process.env.ENABLE_PAYMENTS,
    PADDLE_ENVIRONMENT: process.env.PADDLE_ENVIRONMENT,
    PADDLE_API_KEY: process.env.PADDLE_API_KEY,
    PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET,
    PADDLE_RESEARCHER_MONTHLY_PRICE_ID:
      process.env.PADDLE_RESEARCHER_MONTHLY_PRICE_ID,
    PADDLE_RESEARCHER_PRODUCT_ID: process.env.PADDLE_RESEARCHER_PRODUCT_ID,
    NEXT_PUBLIC_PADDLE_ENVIRONMENT: process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN:
      process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
