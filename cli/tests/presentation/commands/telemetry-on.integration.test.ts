import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git } from "../../helpers/git-sandbox.js";
import { runInProcess } from "../../helpers/in-process-cli.js";
import { createTelemetrySandbox, type TelemetrySandbox } from "../../helpers/telemetry-sandbox.js";

let box: TelemetrySandbox;
let repo: string;

beforeEach(() => {
  box = createTelemetrySandbox();
  repo = box.repository("widgets");
});

afterEach(async () => {
  await rm(box.root, { recursive: true, force: true });
});

const cli = (args: string[], extra: Record<string, string> = {}) =>
  runInProcess(["telemetry", ...args], { cwd: repo, home: box.home, env: box.env(extra) });
const readConsent = () => git(repo, box.gitEnv, "config", "--local", "--get", "aidd.telemetry");

describe("aidd telemetry on, choosing who is measured", () => {
  it("names the person given with --as, in on and in status, and keeps them on the next on", async () => {
    const run = await cli(["on", "--yes", "--as", "Ada Example"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('Measured as "Ada Example".');
    expect(readFileSync(join(box.telemetry, "identity.json"), "utf8")).toBe(
      '{"person_id":"Ada Example"}\n'
    );
    expect((await cli(["status"])).stdout).toContain('Measured as "Ada Example".');
    expect((await cli(["on", "--yes"])).stdout).toContain('Measured as "Ada Example".');
  });

  it("says, after on then off, that measurement was turned off and how to turn it back on", async () => {
    const never = await cli(["status"]);
    expect(never.exitCode).toBe(0);
    expect(never.stdout).toContain("Not measured: this clone has not run `aidd telemetry on`.");
    expect((await cli(["on", "--yes", "--anonymous"])).exitCode).toBe(0);
    expect((await cli(["off"])).exitCode).toBe(0);
    const status = await cli(["status"]);
    expect(status.exitCode).toBe(0);
    expect(status.stdout).toContain(
      "Not measured: measurement was turned off in this clone. Run `aidd telemetry on` to measure it again."
    );
    expect(status.stdout).not.toContain("has not run");
    const task = await cli(["task", "t1"]);
    expect(task.exitCode).toBe(1);
    expect(task.stderr).toContain("Measurement was turned off in this clone");
    expect((await cli(["on", "--yes", "--anonymous"])).exitCode).toBe(0);
    expect((await cli(["status"])).stdout).toContain("This clone is measured since");
  });

  it("turns on under AIDD_TELEMETRY=0 as before, when the choice is given", async () => {
    const run = await cli(["on", "--yes", "--anonymous"], { AIDD_TELEMETRY: "0" });
    expect(run.exitCode).toBe(0);
    expect(readConsent).not.toThrow();
  });
});
