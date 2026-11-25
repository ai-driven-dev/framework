import { describe, expect, it } from "vitest";
import {
  ConflictingIdentityFlagsError,
  IdentityOffWithIdentifierError,
  InvalidIdentityError,
  InvalidReportPeriodError,
  TaskDeclaredNoneWithNameError,
  TaskNameMissingError,
} from "../../../../../src/contexts/telemetry/contract/errors/telemetry.error.js";

describe("when ConflictingIdentityFlagsError is raised", () => {
  it("says nothing itself", () => {
    const error = new ConflictingIdentityFlagsError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ConflictingIdentityFlagsError",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new ConflictingIdentityFlagsError().code).toBe("conflicting-identity-flags");
  });
});

describe("when InvalidIdentityError is raised", () => {
  it("says nothing itself", () => {
    const error = new InvalidIdentityError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidIdentityError",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidIdentityError().code).toBe("invalid-identity");
  });
});

describe("when InvalidReportPeriodError is raised", () => {
  it("carries its detail and says nothing itself", () => {
    const error = new InvalidReportPeriodError("m");
    expect({ name: error.name, detail: error.detail, message: error.message }).toStrictEqual({
      name: "InvalidReportPeriodError",
      detail: "m",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidReportPeriodError("m").code).toBe("invalid-report-period");
  });
});

describe("when TaskDeclaredNoneWithNameError is raised", () => {
  it("says nothing itself", () => {
    const error = new TaskDeclaredNoneWithNameError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "TaskDeclaredNoneWithNameError",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new TaskDeclaredNoneWithNameError().code).toBe("task-declared-none-with-name");
  });
});

describe("when TaskNameMissingError is raised", () => {
  it("says nothing itself", () => {
    const error = new TaskNameMissingError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "TaskNameMissingError",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new TaskNameMissingError().code).toBe("task-name-missing");
  });
});

describe("when IdentityOffWithIdentifierError is raised", () => {
  it("says nothing itself", () => {
    const error = new IdentityOffWithIdentifierError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "IdentityOffWithIdentifierError",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new IdentityOffWithIdentifierError().code).toBe("identity-off-with-identifier");
  });
});
