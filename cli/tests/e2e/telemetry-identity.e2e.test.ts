import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aidd,
  json,
  rowsOf,
  sandbox,
  useReportSandbox,
  WINDOW,
} from "./telemetry-report-sandbox.js";

useReportSandbox();

describe("aidd telemetry identity", () => {
  it("shows the person axis as anonymous until an identity is chosen", async () => {
    const before = rowsOf(await json("person"));
    expect(Object.keys(before)).toEqual(["absent"]);
    expect((await aidd(["report", ...WINDOW, "--axis", "person"])).stdout).toContain("anonymous");
    expect((await aidd(["identity"])).stdout).toContain("No identity is set");
  });

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

  it("carries nothing over from the previous version's identity file", async () => {
    await mkdir(sandbox.userConfig, { recursive: true });
    await writeFile(
      join(sandbox.userConfig, "identity.json"),
      '{"person_id":"old","origin":"prompt"}\n'
    );
    await mkdir(sandbox.telemetry, { recursive: true });
    await writeFile(
      join(sandbox.telemetry, "identity.json"),
      '{"person_id":"old","origin":"prompt"}\n'
    );
    expect(Object.keys(rowsOf(await json("person")))).toEqual(["absent"]);
  });

  it("refuses an identifier that spans lines and writes nothing", async () => {
    const run = await aidd(["identity", "a\nb"]);
    expect(run.exitCode).toBe(1);
    await expect(stat(join(sandbox.telemetry, "identity.json"))).rejects.toThrow();
  });

  it("refuses --off together with an identifier", async () => {
    expect((await aidd(["identity", "person-a", "--off"])).exitCode).toBe(1);
  });
});
