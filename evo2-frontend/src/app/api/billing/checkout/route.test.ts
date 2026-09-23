import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@paddle/paddle-node-sdk";
import { POST } from "./route";

const mock = vi.hoisted(() => ({
  user: vi.fn(),
  access: vi.fn(),
  claim: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  release: vi.fn(),
  price: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  customer: vi.fn(),
}));
vi.mock("~/utils/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mock.user } }),
}));
vi.mock("~/lib/billing/config", async (original) => ({
  ...(await original<typeof import("~/lib/billing/config")>()),
  webhookSecret: () => "test-secret",
  billingConfig: () => ({
    environment: "sandbox",
    appUrl: "http://localhost:3000",
    priceId: "pri_expected",
    productId: "pro_expected",
  }),
}));
vi.mock("~/lib/billing/server", async (original) => ({
  ...(await original<typeof import("~/lib/billing/server")>()),
  getBillingAccess: mock.access,
  billingRpc: mock.claim,
  paddleClient: () => ({
    prices: { get: mock.price },
    transactions: { create: mock.create, get: mock.get },
    customers: { create: mock.customer },
  }),
  billingAdmin: () => ({
    from: () => ({
      insert: mock.insert,
      update: (values: { state: string }) => ({
        eq: () => ({
          eq: values.state === "canceled"
            ? () => ({ is: mock.release })
            : mock.update,
        }),
      }),
    }),
  }),
}));
vi.mock("~/lib/billing/sync", () => ({ syncProviderEntity: vi.fn() }));
const req = (origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/billing/checkout", {
    method: "POST",
    headers: { origin },
    body: JSON.stringify({
      priceId: "pri_attacker",
      customerId: "ctm_someone_else",
      userId: "someone_else",
    }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.user.mockResolvedValue({
    data: { user: { id: "user", email: "researcher@example.test" } },
    error: null,
  });
  mock.access.mockResolvedValue({
    plan: "student",
    status: "inactive",
    customerId: "ctm_owned",
  });
  mock.claim.mockResolvedValue({ new: true, id: "attempt" });
  mock.price.mockResolvedValue({
    productId: "pro_expected",
    status: "active",
    billingCycle: { interval: "month", frequency: 1 },
    trialPeriod: null,
  });
  mock.create.mockResolvedValue({ id: "txn_new" });
  mock.update.mockResolvedValue({ error: null });
  mock.release.mockResolvedValue({ error: null });
});
describe("authenticated checkout", () => {
  it("rejects unauthenticated users and cross-origin requests before provider calls", async () => {
    mock.user.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req("https://attacker.example"))).status).toBe(403);
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("uses configured price and server-owned customer regardless of request body", async () => {
    const response = await POST(req());
    expect(response.status).toBe(200);
    expect(mock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ priceId: "pri_expected", quantity: 1 }],
        customerId: "ctm_owned",
        customData: { user_id: "user", checkout_attempt_id: "attempt" },
      }),
    );
    expect(mock.create.mock.calls[0]?.[0]).not.toHaveProperty("checkout");
  });
  it("does not create another transaction for an in-progress attempt", async () => {
    mock.claim.mockResolvedValue({
      new: false,
      id: "attempt",
      state: "creating",
    });
    expect((await POST(req())).status).toBe(409);
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("resumes the existing ready transaction", async () => {
    mock.claim.mockResolvedValue({
      new: false,
      id: "attempt",
      transaction_id: "txn_existing",
    });
    mock.get.mockResolvedValue({
      id: "txn_existing",
      customerId: "ctm_owned",
      status: "ready",
    });
    const response = await POST(req());
    expect(await response.json()).toEqual({ transactionId: "txn_existing" });
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("sends overdue customers to management instead of selling twice", async () => {
    mock.access.mockResolvedValue({
      status: "past_due",
      subscriptionId: "sub_existing",
    });
    expect((await POST(req())).status).toBe(409);
    expect(mock.claim).not.toHaveBeenCalled();
  });
  it("does not release an attempt after an ambiguous provider timeout", async () => {
    mock.create.mockRejectedValue(new Error("timeout"));
    expect((await POST(req())).status).toBe(502);
    expect(mock.claim).toHaveBeenCalledOnce();
    expect(mock.update).not.toHaveBeenCalled();
    expect(mock.release).not.toHaveBeenCalled();
  });
  it("reports a missing default payment link without exposing provider details", async () => {
    mock.create.mockRejectedValue(new ApiError({
      type: "request_error",
      code: "transaction_default_checkout_url_not_set",
      detail: "private customer data and credentials",
      documentation_url: "https://example.test/private",
    }, null));
    const response = await POST(req());
    expect(response.status).toBe(502);
    const body = await response.text();
    expect(body).toContain("Default payment link");
    expect(body).not.toContain("private");
    expect(mock.update).not.toHaveBeenCalled();
    expect(mock.release).toHaveBeenCalledWith("transaction_id", null);
  });
  it("keeps the attempt reserved on an ambiguous Paddle server error", async () => {
    mock.create.mockRejectedValue(new ApiError({
      type: "api_error",
      code: "internal_error",
      detail: "Internal failure",
      documentation_url: "https://example.test/error",
    }, null));
    expect((await POST(req())).status).toBe(502);
    expect(mock.release).not.toHaveBeenCalled();
  });
  it("reports failure to release a rejected attempt", async () => {
    mock.create.mockRejectedValue(new ApiError({
      type: "request_error",
      code: "transaction_default_checkout_url_not_set",
      detail: "Missing link",
      documentation_url: "https://example.test/error",
    }, null));
    mock.release.mockResolvedValue({ error: { message: "private database details" } });
    const response = await POST(req());
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("could not be released");
  });
  it("reports provider codes but suppresses raw details and malformed codes", async () => {
    for (const code of ["forbidden", "unexpected secret value\n"]) {
      mock.create.mockRejectedValue(new ApiError({
        type: "request_error",
        code,
        detail: "private customer data and credentials",
        documentation_url: "https://example.test/private",
      }, null));
      const response = await POST(req());
      const body = await response.text();
      expect(body).toContain(code === "forbidden" ? "forbidden" : "unknown_provider_error");
      expect(body).not.toContain("private");
      expect(body).not.toContain("secret");
    }
  });
});
