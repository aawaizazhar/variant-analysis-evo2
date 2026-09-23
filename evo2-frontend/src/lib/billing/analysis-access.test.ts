import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeAnalysis } from "./analysis-access";
import { billingRpc } from "./server";

vi.mock("./server", () => ({ billingRpc: vi.fn() }));
const input = {
  variant_position: 100,
  reference: "A",
  alternative: "G",
  genome: "hg38",
  chromosome: "1",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(billingRpc).mockResolvedValue({ id: "reservation" });
});
describe("free launch analysis access", () => {
  it("allows disease exploration for authenticated free-access users", async () => {
    const result = await authorizeAnalysis("user", input, true);
    expect(result.allowDisease).toBe(true);
  });
  it("normalizes assembly aliases and allows supported assemblies", async () => {
    const result = await authorizeAnalysis("user", {
      ...input,
      genome: "GRCh38",
    });
    expect(result.allowDisease).toBe(true);
    await expect(
      authorizeAnalysis("user", { ...input, genome: "hg19" }),
    ).resolves.toMatchObject({ allowDisease: true });
  });
  it("enforces quota and concurrent reservations", async () => {
    vi.mocked(billingRpc).mockResolvedValueOnce({ exceeded: true });
    await expect(authorizeAnalysis("user", input)).rejects.toMatchObject({
      status: 429,
    });
    vi.mocked(billingRpc).mockResolvedValueOnce({ busy: true });
    await expect(authorizeAnalysis("user", input)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("settles only the reservation owned by this request", async () => {
    const allowed = await authorizeAnalysis("user", input);
    await allowed.settle(false);
    expect(billingRpc).toHaveBeenLastCalledWith("settle_free_analysis", {
      p_user: "user",
      p_id: "reservation",
      p_success: false,
    });
    vi.mocked(billingRpc).mockResolvedValueOnce({ reused: true });
    const reused = await authorizeAnalysis("user", input);
    vi.mocked(billingRpc).mockClear();
    await reused.settle(false);
    expect(billingRpc).not.toHaveBeenCalled();
  });
});
