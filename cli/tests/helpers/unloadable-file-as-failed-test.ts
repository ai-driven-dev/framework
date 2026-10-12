import type { RunnerTestCase, RunnerTestFile } from "vitest";
import type { Reporter, Vitest } from "vitest/node";

export class UnloadableFileAsFailedTest implements Reporter {
  private vitest!: Vitest;

  onInit(vitest: Vitest): void {
    this.vitest = vitest;
  }

  onTestRunEnd(): void {
    this.recordLoadFailures(this.vitest.state.getFiles());
  }

  recordLoadFailures(files: RunnerTestFile[]): void {
    for (const file of files) {
      if (file.result?.state !== "fail" || file.tasks.length > 0) continue;
      const loadFailure: Omit<RunnerTestCase, "context"> = {
        type: "test",
        id: `${file.id}_load`,
        name: "the file loads",
        fullName: "the file loads",
        fullTestName: "the file loads",
        artifacts: [],
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
