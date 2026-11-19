import { describe, expect, it } from "vitest";
import { CheckFilterValue } from "../../../../../src/contexts/telemetry/application/report/check-filter-value.js";

const check = new CheckFilterValue();

describe("CheckFilterValue", () => {
  it("keeps the value trimmed", () => {
    expect(check.execute({ value: "  fix-login " })).toEqual({
      status: "valid",
      text: "fix-login",
    });
  });

  it("refuses an empty value", () => {
    expect(check.execute({ value: "   " })).toEqual({ status: "refused", reason: "It is empty." });
  });

  it("refuses a value outside its choices, and lists them", () => {
    expect(check.execute({ value: "gpt", choices: ["claude", "codex"] })).toEqual({
      status: "refused",
      reason: "Allowed choices are claude, codex.",
    });
    expect(check.execute({ value: " codex", choices: ["claude", "codex"] })).toEqual({
      status: "valid",
      text: "codex",
    });
  });
});
