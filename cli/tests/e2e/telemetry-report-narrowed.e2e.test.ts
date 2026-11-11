import { describe, expect, it } from "vitest";
import { aidd, held, useReportSandbox } from "./telemetry-report-sandbox.js";

useReportSandbox();

describe("aidd telemetry report, narrowed", () => {
  it("refuses a flag given twice with exit 1, naming the flag, and reads nothing", async () => {
    const before = await held();
    const run = await aidd(["report", "--task", "a", "--task", "b"]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain("--task");
    expect(await held()).toEqual(before);
  });
});
