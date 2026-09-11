import type { RunnerTestCase, RunnerTestFile } from "vitest";
import type { Reporter } from "vitest/reporters";

export class UnloadableFileAsFailedTest implements Reporter {
  onFinished(files: RunnerTestFile[]): void {
    for (const file of files) {
      if (file.result?.state !== "fail" || file.tasks.length > 0) continue;
      const loadFailure: Omit<RunnerTestCase, "context"> = {
        type: "test",
        id: `${file.id}_load`,
        name: "the file loads",
        mode: "run",
        meta: {},
        file,
        suite: file,
        timeout: 0,
        annotations: [],
        result: { state: "fail", errors: file.result.errors ?? [] },
      };
      file.tasks.push(loadFailure as RunnerTestCase);
    }
  }
}
