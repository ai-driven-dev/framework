import { writeFileSync } from "node:fs";
import type { RunnerTask, RunnerTestFile } from "vitest";
import { defineConfig } from "vitest/config";
import { UnloadableFileAsFailedTest } from "../../helpers/unloadable-file-as-failed-test.js";

function testsOf(task: RunnerTask): RunnerTask[] {
  return task.type === "suite" ? task.tasks.flatMap(testsOf) : [task];
}

const collectedAsStrykerDoes = {
  onFinished(files: RunnerTestFile[]): void {
    const tests = files.flatMap(testsOf).filter((test) => test.result);
    const seen = tests.map((test) => ({
      file: test.file.name,
      state: test.result?.state,
      error: test.result?.errors?.[0]?.message,
    }));
    writeFileSync(String(process.env.COLLECTED), JSON.stringify(seen));
  },
};

export default defineConfig({
  test: {
    include: ["*.fixture-test.ts"],
    reporters: [new UnloadableFileAsFailedTest(), collectedAsStrykerDoes],
  },
});
