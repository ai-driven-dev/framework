import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const FIXTURE = fileURLToPath(new URL("../fixtures/stryker-filter/", import.meta.url));
const CLI_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const RUNNER = join(
  dirname(createRequire(import.meta.url).resolve("@stryker-mutator/vitest-runner/package.json")),
  "dist/src/vitest-test-runner.js"
);

it("Stryker applies each selected name only to its exact file", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-stryker-filter-"));
  try {
    cpSync(FIXTURE, root, { recursive: true });
    symlinkSync(join(CLI_ROOT, "node_modules"), join(root, "node_modules"), "junction");
    const child = spawnSync(process.execPath, [join(root, "probe.mjs"), RUNNER], {
      cwd: root,
      env: Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith("VITEST"))
      ),
      encoding: "utf8",
      timeout: 30000,
    });
    expect(child.error, child.stderr).toBeUndefined();
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(root, "result.json"), "utf8"))).toStrictEqual({
      dryRunCount: 6,
      crossFile: {
        status: "survived",
        nrOfTests: 2,
        executed: ["a.test.mjs#left", "b.test.mjs#right"],
      },
      exactFile: {
        status: "survived",
        nrOfTests: 1,
        executed: ["a.test.mjs#left"],
      },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
