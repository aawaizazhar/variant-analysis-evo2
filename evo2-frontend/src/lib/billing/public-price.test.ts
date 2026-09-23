import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicResearcherPrice } from "./public-price";

vi.mock("./config", () => ({
  billingConfig: () => ({
    environment: "sandbox",
    apiKey: "private-test-key",
    priceId: "pri_expected",
    productId: "pro_expected",
  }),
}));
const request = vi.fn();
const catalog = () => ({
  data: {
    id: "pri_expected",
    product_id: "pro_expected",
    status: "active",
    unit_price: { amount: "1000", currency_code: "USD" },
    billing_cycle: { interval: "month", frequency: 1 },
    trial_period: null,
  },
});
beforeEach(() => {
  vi.stubGlobal("fetch", request);
  request.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("public catalog price", () => {
  it("returns only a formatted sandbox price without exposing credentials", async () => {
    request.mockResolvedValue(Response.json(catalog()));
    expect(await getPublicResearcherPrice()).toEqual({
      label: "$10.00",
      currency: "USD",
      sandbox: true,
    });
    expect(request.mock.calls[0]?.[0]).toBe(
      "https://sandbox-api.paddle.com/prices/pri_expected",
    );
  });
  it("does not advertise a different product, annual price, or invalid response", async () => {
    for (const data of [
      { ...catalog().data, product_id: "pro_wrong" },
      { ...catalog().data, id: "pri_wrong" },
      { ...catalog().data, billing_cycle: { interval: "year", frequency: 1 } },
      { ...catalog().data, status: "archived" },
    ]) {
      request.mockResolvedValue(Response.json({ data }));
      expect(await getPublicResearcherPrice()).toBeNull();
    }
  });
  it("shows unavailable rather than fabricating a price on API failures", async () => {
    request.mockResolvedValue(
      new Response("private provider error", { status: 403 }),
    );
    expect(await getPublicResearcherPrice()).toBeNull();
    request.mockRejectedValue(
      new Error("private credentials in transport error"),
    );
    expect(await getPublicResearcherPrice()).toBeNull();
  });
  it("uses currency precision for currencies without fractional units", async () => {
    const body = catalog();
    body.data.unit_price = { amount: "1000", currency_code: "JPY" };
    request.mockResolvedValue(Response.json(body));
    expect((await getPublicResearcherPrice())?.label).toBe("¥1,000");
  });
});
