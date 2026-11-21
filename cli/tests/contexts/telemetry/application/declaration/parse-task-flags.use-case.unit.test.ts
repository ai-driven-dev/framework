import { describe, expect, it } from "vitest";
import { ParseTaskFlags } from "../../../../../src/contexts/telemetry/application/declaration/parse-task-flags.use-case.js";
import {
  TaskDeclaredNoneWithNameError,
  TaskNameMissingError,
} from "../../../../../src/contexts/telemetry/domain/telemetry.error.js";

const resolve = new ParseTaskFlags();

describe("ParseTaskFlags", () => {
  it("makes a task of a typed name and ticket", () => {
    expect(resolve.execute({ name: " Fix login ", ticket: "T-1", none: false }).request).toEqual({
      kind: "task",
      task: "Fix login",
      ticket: "T-1",
    });
  });

  it("declares no task when told so", () => {
    expect(resolve.execute({ name: undefined, ticket: undefined, none: true }).request).toEqual({
      kind: "none",
    });
  });

  it("refuses a name given with none", () => {
    expect(() => resolve.execute({ name: "x", ticket: undefined, none: true })).toThrow(
      TaskDeclaredNoneWithNameError
    );
  });

  it("refuses a request with no name", () => {
    expect(() => resolve.execute({ name: " ", ticket: "T-1", none: false })).toThrow(
      TaskNameMissingError
    );
  });
});
