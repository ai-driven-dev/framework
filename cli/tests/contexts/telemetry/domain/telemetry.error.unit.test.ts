import { describe, expect, it } from "vitest";
import {
  ConflictingIdentityFlagsError,
  InvalidIdentityError,
  InvalidReportPeriodError,
  TaskDeclaredNoneWithNameError,
  TaskNameMissingError,
} from "../../../../src/contexts/telemetry/domain/telemetry.error.js";

describe("ConflictingIdentityFlagsError", () => {
  it("says exactly what went wrong", () => {
    const error = new ConflictingIdentityFlagsError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ConflictingIdentityFlagsError",
      message: "--as names you and --anonymous names nobody: give one of them.",
    });
  });

  it("carries its stable code", () => {
    expect(new ConflictingIdentityFlagsError().code).toBe("conflicting-identity-flags");
  });
});

describe("InvalidIdentityError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidIdentityError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidIdentityError",
      message: "An identity is one non-empty line of at most 128 characters. Nothing was changed.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidIdentityError().code).toBe("invalid-identity");
  });
});

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

describe("TaskDeclaredNoneWithNameError", () => {
  it("says exactly what went wrong", () => {
    const error = new TaskDeclaredNoneWithNameError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "TaskDeclaredNoneWithNameError",
      message: "--none declares no task: give it neither a name nor --ticket.",
    });
  });

  it("carries its stable code", () => {
    expect(new TaskDeclaredNoneWithNameError().code).toBe("task-declared-none-with-name");
  });
});

describe("TaskNameMissingError", () => {
  it("says exactly what went wrong", () => {
    const error = new TaskNameMissingError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "TaskNameMissingError",
      message:
        "A task needs a name: aidd telemetry task <name> [--ticket <ref>], or --none. See what the work is bound to with aidd telemetry status.",
    });
  });

  it("carries its stable code", () => {
    expect(new TaskNameMissingError().code).toBe("task-name-missing");
  });
});
