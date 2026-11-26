import { afterEach, beforeEach } from "vitest";
import { createTestEnv, runCli } from "../../../shared/testing/cli-sandbox.builder.js";
import { sandboxGitEnv } from "../../../shared/testing/git-sandbox.builder.js";
import {
  type Aidd,
  declareBranch as declareBranchOn,
  type ReportPaths,
  reportEnv,
  reportPaths,
  seedReport,
} from "./telemetry-report-seed.builder.js";

/* The sandbox every `aidd telemetry report` e2e file starts each test from, seeded by
 * `tests/contexts/telemetry/testing/telemetry-report-seed.builder.ts` through the built binary. One file per subject, so
 * Vitest runs them side by side instead of one after another. */

let env: Awaited<ReturnType<typeof createTestEnv>>;
let paths: ReportPaths;

export const aidd: Aidd = (args, extra = {}, cwd = paths.repo) =>
  runCli(["telemetry", ...args], cwd, env.fakeHome, { env: reportEnv(paths, extra) });

/** Gives each test of the calling file a fresh sandbox, removed once it ends. */
export function useReportSandbox(): void {
  beforeEach(async () => {
    env = await createTestEnv("telemetry-report");
    paths = reportPaths(env.tempDir);
    await seedReport(paths, env.fakeHome, sandboxGitEnv(env.fakeHome), aidd);
  });
  afterEach(async () => {
    await env.cleanup();
  });
}

export const declareBranch = () => declareBranchOn(aidd);
