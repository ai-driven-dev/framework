import { describe, expect, it } from "vitest";
import { TaskDeclaredNoneWithNameError } from "../../../../src/shared/domain/errors/task-declared-none-with-name-error.js";

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
