import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aidd, json, rowsOf, sandbox, useReportSandbox } from "./telemetry-report-sandbox.js";

useReportSandbox();

describe("aidd telemetry identity", () => {
  it("names the person on the person axis, writes an owner-only file, and --off removes it", async () => {
    const set = await aidd(["identity", "person-a"]);
    expect(set.exitCode).toBe(0);
    const file = join(sandbox.telemetry, "identity.json");
    expect(await readFile(file, "utf8")).toBe('{"person_id":"person-a"}\n');
    if (process.platform !== "win32") expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(Object.keys(rowsOf(await json("person")))).toEqual(["person-a"]);
    expect((await aidd(["identity"])).stdout).toContain('"person-a"');
    const off = await aidd(["identity", "--off"]);
    expect(off.stdout).toContain("removed");
    await expect(stat(file)).rejects.toThrow();
    expect(Object.keys(rowsOf(await json("person")))).toEqual(["absent"]);
  });

  it("refuses --off together with an identifier", async () => {
    expect((await aidd(["identity", "person-a", "--off"])).exitCode).toBe(1);
  });
});
