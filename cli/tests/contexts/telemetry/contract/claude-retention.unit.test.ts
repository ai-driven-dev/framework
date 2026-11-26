import { describe, expect, it } from "vitest";
import {
  RETENTION_DEFAULT_DAYS,
  RETENTION_WANTED_DAYS,
} from "../../../../src/contexts/telemetry/contract/claude-retention.js";

describe("transcript retention", () => {
  it("is short by default of what history needs, so a project with no setting is told", () => {
    expect(RETENTION_DEFAULT_DAYS).toBeLessThan(RETENTION_WANTED_DAYS);
  });
});
