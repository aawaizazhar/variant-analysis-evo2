import { describe, expect, it } from "vitest";
import { subscriptionSnapshot } from "./sync";

const sub = {
  id: "sub_test",
  status: "active",
  updatedAt: "2026-09-20T00:00:00Z",
  currentBillingPeriod: { endsAt: "2026-10-20T00:00:00Z" },
  scheduledChange: { action: "cancel", effectiveAt: "2026-10-20T00:00:00Z" },
  items: [
    {
      price: { id: "pri_expected", productId: "pro_expected" },
      quantity: 1,
      recurring: true,
    },
  ],
};
describe("provider subscription projection", () => {
  it("preserves scheduled cancellation without canceling access early", () => {
    expect(
      subscriptionSnapshot(sub as never, "pri_expected", "pro_expected"),
    ).toMatchObject({
      eligible: true,
      status: "active",
      scheduled_change: {
        action: "cancel",
        effective_at: "2026-10-20T00:00:00Z",
      },
    });
  });
  it("rejects unexpected prices, products, quantities, and additional items", () => {
    expect(
      subscriptionSnapshot(sub as never, "pri_wrong", "pro_expected").eligible,
    ).toBe(false);
    expect(
      subscriptionSnapshot(sub as never, "pri_expected", "pro_wrong").eligible,
    ).toBe(false);
    expect(
      subscriptionSnapshot(
        { ...sub, items: [{ ...sub.items[0], quantity: 2 }] } as never,
        "pri_expected",
        "pro_expected",
      ).eligible,
    ).toBe(false);
    expect(
      subscriptionSnapshot(
        { ...sub, items: [...sub.items, ...sub.items] } as never,
        "pri_expected",
        "pro_expected",
      ).eligible,
    ).toBe(false);
  });
});
