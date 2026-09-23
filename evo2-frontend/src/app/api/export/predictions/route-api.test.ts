import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "~/utils/supabase/server";
import { GET } from "./route";

vi.mock("~/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

const createClientMock = vi.mocked(createClient);

function exportSupabase({
  user,
  historyRows = [],
}: {
  user: { id: string } | null;
  historyRows?: Record<string, unknown>[];
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === "prediction_history") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: historyRows,
                  error: null,
                }),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("GET /api/export/predictions", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("returns Unauthorized without a user session", async () => {
    createClientMock.mockResolvedValue(
      exportSupabase({ user: null }) as never,
    );

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("allows CSV export for every authenticated account", async () => {
    createClientMock.mockResolvedValue(
      exportSupabase({ user: { id: "user-1" } }) as never,
    );

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
  });

  it("returns a downloadable CSV for researcher accounts", async () => {
    createClientMock.mockResolvedValue(
      exportSupabase({
        user: { id: "user-1" },
        historyRows: [
          {
            created_at: "2026-07-07T10:15:00.000Z",
            genome_assembly: "hg38",
            chromosome: "chr17",
            variant_position: 43044295,
            reference: "A",
            alternative: "G",
            prediction: "likely_pathogenic",
            confidence: 0.86,
          },
        ],
      }) as never,
    );

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain(
      "dna-analyzer-prediction-history-",
    );
    await expect(response.text()).resolves.toContain(
      "2026-07-07T10:15:00.000Z,hg38,chr17,43044295,A,G",
    );
  });
});
