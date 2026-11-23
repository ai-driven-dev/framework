import { describe, expect, it } from "vitest";
import {
  everyProject,
  singlePythonRepo,
  typescriptOrMonorepo,
} from "../../../../../src/contexts/tools/domain/profile/recommendation.js";

const project = (stack: "typescript" | "python" | "unknown", isMonorepo: boolean) => ({
  stack,
  isMonorepo,
  hasFramework: false,
});

describe("when a tool is recommended", () => {
  it.each([
    ["no project", undefined, [true, false, false]],
    ["a typescript repo", project("typescript", false), [true, true, false]],
    ["a python monorepo", project("python", true), [true, true, false]],
    ["a python repo", project("python", false), [true, false, true]],
  ])("for %s", (_case, context, expected) => {
    expect([everyProject(), typescriptOrMonorepo(context), singlePythonRepo(context)]).toEqual(
      expected
    );
  });
});
