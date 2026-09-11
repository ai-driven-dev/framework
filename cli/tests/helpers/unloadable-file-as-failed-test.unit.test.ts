import type { RunnerTestFile } from "vitest";
import { describe, expect, it } from "vitest";
import mutation from "../../vitest.mutation.config.js";
import { UnloadableFileAsFailedTest } from "./unloadable-file-as-failed-test.js";

const LOAD_ERROR = {
  name: "Error",
  message: "SkillsCapability requires either prefix or directory",
};

function testFile(state: "pass" | "fail", tasks: RunnerTestFile["tasks"] = []): RunnerTestFile {
  const file: RunnerTestFile = {
    id: "cursor",
    name: "cursor.unit.test.ts",
    mode: "run",
    meta: {},
    type: "suite",
    filepath: "/repo/cli/tests/contexts/tools/domain/profiles/cursor.unit.test.ts",
    projectName: "unit",
    tasks,
    result: { state, errors: state === "fail" ? [LOAD_ERROR] : [] },
    get file() {
      return file;
    },
  };
  return file;
}

describe("a test file that fails to load, in a mutation run", () => {
  it("counts as one failed test carrying the load error", () => {
    const unloaded = testFile("fail");
    new UnloadableFileAsFailedTest().onFinished([unloaded]);
    expect(unloaded.tasks).toHaveLength(1);
    expect(unloaded.tasks[0]).toMatchObject({
      type: "test",
      mode: "run",
      file: unloaded,
      suite: unloaded,
      result: { state: "fail", errors: [LOAD_ERROR] },
    });
  });

  it("leaves a file that loaded as it is, whether its tests passed or failed", () => {
    const passed = testFile("pass");
    const failed = testFile("fail", [{ ...testFile("fail"), id: "inner" }]);
    new UnloadableFileAsFailedTest().onFinished([passed, failed]);
    expect(passed.tasks).toHaveLength(0);
    expect(failed.tasks.map((task) => task.id)).toStrictEqual(["inner"]);
  });

  it("is a reporter of every mutation run", () => {
    expect(mutation.test?.reporters).toContainEqual(expect.any(UnloadableFileAsFailedTest));
  });
});
