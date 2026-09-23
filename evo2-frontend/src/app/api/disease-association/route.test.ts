import type * as Pipeline from "~/lib/snv-pipeline";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import {
  getDiseaseAssociation,
  getEvo2ResultWithCache,
  persistAnalysisHistory,
} from "~/lib/snv-pipeline";

vi.mock("~/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user" } }, error: null }),
    },
  }),
}));
vi.mock("~/utils/supabase/admin", () => ({ createPipelineClient: () => ({}) }));
vi.mock("~/lib/snv-pipeline", async (importOriginal) => ({
  ...(await importOriginal<typeof Pipeline>()),
  getEvo2ResultWithCache: vi.fn(),
  getDiseaseAssociation: vi.fn(),
  persistAnalysisHistory: vi.fn(),
}));

vi.mock("~/lib/billing/config", async original => ({ ...await original<typeof import("~/lib/billing/config")>(), billingConfig: () => ({environment:"sandbox"}) }));
vi.mock("~/lib/billing/server", () => ({
  getBillingAccess: vi.fn(async () => ({plan:"researcher"})),
  billingRpc: vi.fn(async () => ({id:"reservation"})),
  billingAdmin: vi.fn(() => ({})),
}));
beforeEach(() => vi.clearAllMocks());

describe("disease endpoint gate", () => {
  it("uses the server result rather than a browser-supplied pathogenic label", async () => {
    vi.mocked(getEvo2ResultWithCache).mockResolvedValue({
      normalized: { variant_key: "1:100:A>G" },
      evo2: { prediction: "benign" },
      warnings: [],
    } as never);
    vi.mocked(getDiseaseAssociation).mockResolvedValue({
      disease_association: { status: "skipped_benign" },
    } as never);
    const response = await POST(
      new Request("http://localhost/api/disease-association", {
        method: "POST",
        body: JSON.stringify({
          variant_position: 100,
          reference: "A",
          alternative: "G",
          genome: "hg38",
          chromosome: "1",
          evo2: { prediction: "pathogenic" },
          explore_disease_associations: true,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(getDiseaseAssociation).toHaveBeenCalledWith(
      expect.objectContaining({
        evo2: { prediction: "benign" },
        explore: true,
      }),
    );
    expect(persistAnalysisHistory).toHaveBeenCalledOnce();
  });

  it("rejects a non-boolean exploration flag", async () => {
    const response = await POST(
      new Request("http://localhost/api/disease-association", {
        method: "POST",
        body: JSON.stringify({
          variant_position: 100,
          reference: "A",
          alternative: "G",
          genome: "hg38",
          chromosome: "1",
          explore_disease_associations: "true",
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(getEvo2ResultWithCache).not.toHaveBeenCalled();
  });
});
