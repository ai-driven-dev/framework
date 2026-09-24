import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const FIXTURE = fileURLToPath(new URL("../fixtures/unloadable-test-file/", import.meta.url));
const VITEST = join(
  dirname(createRequire(import.meta.url).resolve("vitest/package.json")),
  "vitest.mjs"
);
const OUTSIDE_THIS_RUN = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("VITEST"))
);

it("a real vitest run hands Stryker's collection one failed test for a file that failed to load", () => {
  const collected = join(mkdtempSync(join(tmpdir(), "unloadable-test-file-")), "collected.json");
  spawnSync(
    process.execPath,
    [VITEST, "run", "--root", FIXTURE, "--config", join(FIXTURE, "vitest.config.ts")],
    {
      env: { ...OUTSIDE_THIS_RUN, COLLECTED: collected },
      encoding: "utf8",
    }
  );
  const seen: { file: string }[] = JSON.parse(readFileSync(collected, "utf8"));
  expect(seen.sort((a, b) => a.file.localeCompare(b.file))).toStrictEqual([
    {
      file: "broken.fixture-test.ts",
      state: "fail",
      error: "the module under test failed to load",
    },
    { file: "loads.fixture-test.ts", state: "pass" },
  ]);
});
