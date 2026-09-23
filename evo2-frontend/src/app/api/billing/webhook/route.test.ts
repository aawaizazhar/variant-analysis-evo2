import { createHmac } from "node:crypto";
import { Paddle, Environment } from "@paddle/paddle-node-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { syncProviderEntity } from "~/lib/billing/sync";

const stubs = vi.hoisted(() => ({ seen: vi.fn() }));
vi.mock("~/lib/billing/config", async (original) => ({
  ...(await original<typeof import("~/lib/billing/config")>()),
  billingConfig: () => ({ environment: "sandbox" }),
  webhookSecret: () => "test-secret",
}));
vi.mock("~/lib/billing/server", async (original) => ({
  ...(await original<typeof import("~/lib/billing/server")>()),
  paddleClient: () =>
    new Paddle("pdl_sdbx_test", { environment: Environment.sandbox }),
  billingAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: stubs.seen }) }),
      }),
    }),
  }),
}));
vi.mock("~/lib/billing/sync", () => ({ syncProviderEntity: vi.fn() }));
const raw = () =>
  JSON.stringify({
    event_id: "evt_test",
    event_type: "subscription.updated",
    occurred_at: new Date().toISOString(),
    data: {
      id: "sub_test",
      items: [],
      billing_cycle: { interval: "month", frequency: 1 },
    },
  });
function request(
  body: string,
  signedBody = body,
  secret = "test-secret",
  timestamp = Math.floor(Date.now() / 1000),
) {
  const hmac = createHmac("sha256", secret)
    .update(`${timestamp}:${signedBody}`)
    .digest("hex");
  return new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    body,
    headers: { "paddle-signature": `ts=${timestamp};h1=${hmac}` },
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  stubs.seen.mockResolvedValue({ data: null, error: null });
  vi.mocked(syncProviderEntity).mockResolvedValue(undefined);
});
describe("signed billing webhook", () => {
  it("verifies raw body using the official SDK, without an auth cookie", async () => {
    const response = await POST(request(raw()));
    expect(response.status).toBe(200);
    expect(syncProviderEntity).toHaveBeenCalledWith(
      "subscription.updated",
      "sub_test",
      "evt_test",
      expect.any(String),
    );
  });
  it("rejects tampering, wrong destination secret, and stale signatures", async () => {
    const body = raw();
    expect((await POST(request(body + " ", body))).status).toBe(400);
    expect((await POST(request(body, body, "wrong-secret"))).status).toBe(400);
    expect(
      (
        await POST(
          request(
            body,
            body,
            "test-secret",
            Math.floor(Date.now() / 1000) - 600,
          ),
        )
      ).status,
    ).toBe(400);
    expect(syncProviderEntity).not.toHaveBeenCalled();
  });
  it("does not process an already committed event again", async () => {
    stubs.seen.mockResolvedValue({
      data: { event_id: "evt_test" },
      error: null,
    });
    expect((await POST(request(raw()))).status).toBe(200);
    expect(syncProviderEntity).not.toHaveBeenCalled();
  });
  it("returns a retryable failure instead of acknowledging lost database work", async () => {
    vi.mocked(syncProviderEntity).mockRejectedValue(
      new Error("database offline"),
    );
    expect((await POST(request(raw()))).status).toBeGreaterThanOrEqual(500);
  });
});
