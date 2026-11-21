import { describe, expect, it } from "vitest";
import { InvalidReportPeriodError } from "../../../../src/shared/domain/errors/invalid-report-period-error.js";

describe("InvalidReportPeriodError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidReportPeriodError("m");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidReportPeriodError",
      message: "m",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidReportPeriodError("m").code).toBe("invalid-report-period");
  });
});
