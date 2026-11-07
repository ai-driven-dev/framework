import { rm } from "node:fs/promises";
import { afterEach, beforeEach } from "vitest";
import { runInProcess } from "./in-process-cli.js";
import {
  type Aidd,
  addCall as addCallTo,
  declareBranch as declareBranchOn,
  held as heldIn,
  json as jsonOf,
  type ReportPaths,
  reportEnv,
  reportPaths,
  seedReport,
} from "./telemetry-report-seed.js";
import { createTelemetrySandbox, type TelemetrySandbox } from "./telemetry-sandbox.js";

/** The report world of `telemetry-report-seed.ts`, seeded through the command layer in process
 * and removed once each test ends: the integration counterpart of the e2e report sandbox. */
export interface InProcessReportWorld {
  readonly box: TelemetrySandbox;
  readonly paths: ReportPaths;
  readonly aidd: Aidd;
  addCall(call: Parameters<typeof addCallTo>[1]): Promise<void>;
  held(): Promise<Record<string, string>>;
  declareBranch(): Promise<void>;
  json(axis: string): ReturnType<typeof jsonOf>;
}

export function useInProcessReportWorld(): () => InProcessReportWorld {
  let current: InProcessReportWorld | undefined;
  beforeEach(async () => {
    const box = createTelemetrySandbox();
    const paths = reportPaths(box.root);
    const aidd: Aidd = (args, extra = {}, cwd = paths.repo) =>
      runInProcess(["telemetry", ...args], {
        cwd,
        home: box.home,
        env: reportEnv(paths, extra),
      });
    await seedReport(paths, box.home, box.gitEnv, aidd);
    current = {
      box,
      paths,
      aidd,
      addCall: (call) => addCallTo(paths, call),
      held: () => heldIn(paths),
      declareBranch: () => declareBranchOn(aidd),
      json: (axis) => jsonOf(aidd, axis),
    };
  });
  afterEach(async () => {
    if (current) await rm(current.box.root, { recursive: true, force: true });
    current = undefined;
  });
  return () => {
    if (!current) throw new Error("the report world is only available inside a test");
    return current;
  };
}
