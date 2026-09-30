import { describe, expect, it } from "vitest";
import { environmentWithoutGitVariables } from "../../../src/runtime/git/git-environment.js";

describe("environmentWithoutGitVariables", () => {
  it("drops every variable git exports into a hook, and keeps the rest", () => {
    expect(
      environmentWithoutGitVariables({
        GIT_DIR: "/elsewhere/.git",
        GIT_WORK_TREE: "/elsewhere",
        GIT_INDEX_FILE: "/elsewhere/index",
        PATH: "/usr/bin",
        MY_GIT_THING: "kept",
      })
    ).toStrictEqual({ PATH: "/usr/bin", MY_GIT_THING: "kept" });
  });

  it("reads the process environment when given none", () => {
    expect(environmentWithoutGitVariables().PATH).toBe(process.env.PATH);
  });
});
