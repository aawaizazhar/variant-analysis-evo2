import { describe, expect, it } from "vitest";

import {
  formatAllowedGenomes,
  formatPlanName,
  getPlanLimits,
  isGenomeAllowedForPlan,
  normalizePlanType,
  normalizeSubscriptionStatus,
  planAllowsAllGenomes,
} from "./plans";

describe("plan helpers", () => {
  it("defaults unknown plan and subscription values to safe student/inactive values", () => {
    expect(normalizePlanType("enterprise")).toBe("student");
    expect(normalizePlanType(undefined)).toBe("student");
    expect(normalizeSubscriptionStatus("unknown")).toBe("inactive");
    expect(normalizeSubscriptionStatus(undefined)).toBe("inactive");
  });

  it("recognizes real subscription states and retires demo status", () => {
    expect(normalizePlanType("researcher")).toBe("researcher");
    expect(normalizeSubscriptionStatus("demo")).toBe("inactive");
    expect(normalizeSubscriptionStatus("active")).toBe("active");
  });

  it("enforces student genome and feature limits", () => {
    const limits = getPlanLimits("student");

    expect(limits.dailyPredictions).toBe(5);
    expect(limits.csvExport).toBe(false);
    expect(limits.predictionHistory).toBe(false);
    expect(limits.diseaseAssociation).toBe(false);
    expect(planAllowsAllGenomes("student")).toBe(false);
    expect(isGenomeAllowedForPlan("student", "hg38")).toBe(true);
    expect(isGenomeAllowedForPlan("student", "hg19")).toBe(false);
    expect(formatAllowedGenomes("student")).toBe("hg38");
    expect(formatPlanName("student")).toBe("Student");
  });

  it("allows researcher users to use every available human assembly", () => {
    const limits = getPlanLimits("researcher");

    expect(limits.dailyPredictions).toBe(50);
    expect(limits.csvExport).toBe(true);
    expect(limits.predictionHistory).toBe(true);
    expect(limits.diseaseAssociation).toBe(true);
    expect(planAllowsAllGenomes("researcher")).toBe(true);
    expect(isGenomeAllowedForPlan("researcher", "hg19")).toBe(true);
    expect(isGenomeAllowedForPlan("researcher", "t2t-chm13")).toBe(true);
    expect(formatAllowedGenomes("researcher")).toBe(
      "All available human assemblies",
    );
    expect(formatPlanName("researcher")).toBe("Researcher");
  });
});
