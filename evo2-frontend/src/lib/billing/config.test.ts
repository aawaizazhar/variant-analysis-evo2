import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { billingConfig, webhookSecret } from "./config";

beforeEach(() => {
  for (const [key, value] of Object.entries({
    PADDLE_ENVIRONMENT: "sandbox",
    NEXT_PUBLIC_PADDLE_ENVIRONMENT: "sandbox",
    PADDLE_API_KEY: "pdl_sdbx_apikey_test",
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_token",
    PADDLE_RESEARCHER_MONTHLY_PRICE_ID: "pri_test",
    PADDLE_RESEARCHER_PRODUCT_ID: "pro_test",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  }))
    vi.stubEnv(key, value);
});
afterEach(() => vi.unstubAllEnvs());
describe("billing configuration", () => {
  it("accepts sandbox configuration without a webhook secret for read operations", () => {
    vi.stubEnv("PADDLE_WEBHOOK_SECRET", "");
    expect(billingConfig().environment).toBe("sandbox");
    expect(() => webhookSecret()).toThrow("webhook secret");
  });
  it("rejects mixed environments without exposing the key", () => {
    vi.stubEnv("PADDLE_ENVIRONMENT", "live");
    expect(() => billingConfig()).toThrow("environment");
    try {
      billingConfig();
    } catch (error) {
      expect(String(error)).not.toContain("pdl_sdbx");
    }
  });
  it("requires HTTPS for remote sites", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://example.com");
    expect(() => billingConfig()).toThrow("URL");
  });
  it("requires actual configured product identifiers", () => {
    vi.stubEnv("PADDLE_RESEARCHER_MONTHLY_PRICE_ID", "");
    expect(() => billingConfig()).toThrow("incomplete");
  });
});
