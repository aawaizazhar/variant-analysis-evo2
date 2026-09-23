import { describe, expect, it, vi, beforeEach } from "vitest";

import { createClient } from "~/utils/supabase/server";
import { billingRpc } from "~/lib/billing/server";
import { POST } from "./route";

vi.mock("~/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("~/utils/supabase/admin", () => ({
  createPipelineClient: vi.fn((client: unknown) => client),
}));

vi.mock("~/lib/billing/config", async original => ({ ...await original<typeof import("~/lib/billing/config")>(), billingConfig: () => ({environment:"sandbox"}) }));
vi.mock("~/lib/billing/server", () => ({
  getBillingAccess: vi.fn(async () => ({plan:"student"})),
  billingRpc: vi.fn(async () => ({id:"reservation"})),
  billingAdmin: vi.fn(() => ({})),
}));

const createClientMock = vi.mocked(createClient);

function authSupabase(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  };
}

const validVariantBody = {
  variant_position: 5227002,
  reference: "T",
  alternative: "A",
  genome: "hg38",
  chromosome: "chr11",
  gene: "HBB",
};

describe("POST /api/variant-analysis", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("returns Unauthorized when the request has no session", async () => {
    createClientMock.mockResolvedValue(authSupabase(null) as never);

    const response = await POST(
      new Request("http://localhost/api/variant-analysis", {
        method: "POST",
        body: JSON.stringify(validVariantBody),
      }),
    );

    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(response.status).toBe(401);
  });

  it("returns a clear validation error for invalid JSON", async () => {
    createClientMock.mockResolvedValue(authSupabase({ id: "user-1" }) as never);

    const response = await POST(
      new Request("http://localhost/api/variant-analysis", {
        method: "POST",
        body: "not-json",
      }),
    );

    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(response.status).toBe(400);
  });

  it("enforces the free daily quota before inference", async () => {
    createClientMock.mockResolvedValue(authSupabase({ id: "user-1" }) as never);
    vi.mocked(billingRpc).mockResolvedValueOnce({ exceeded: true });

    const response = await POST(
      new Request("http://localhost/api/variant-analysis", {
        method: "POST",
        body: JSON.stringify(validVariantBody),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Daily quota of 50 analyses exceeded. It resets at midnight UTC.",
    });
    expect(response.status).toBe(429);
  });
});
