/**
 * A unit test touches no real environment: no filesystem, no process, no home or temp
 * directory. The unit files that still import `node:fs`, `node:os` or `node:child_process` are
 * listed and may not grow; one that stops must come off the list, so it only ever gets shorter.
 * Biome already holds `node:fs` and `node:child_process` outside `tests/contexts`; this
 * holds every unit test, and `node:os` too.
 */
import { describe, expect, it } from "vitest";
import { read, tsFilesUnder } from "./source-graph.js";

/** Unit test files that import a real-environment module today. */
const IMPURE_UNIT_TESTS: readonly string[] = [
  "tests/contexts/installation/application/marketplace/cache-built-marketplace.use-case.unit.test.ts",
  "tests/contexts/installation/application/plugin/add/foreign-user-scope-dir.unit.test.ts",
  "tests/contexts/installation/application/plugin/plugin-materializer.unit.test.ts",
  "tests/contexts/installation/application/removal/remove-plugin.use-case.unit.test.ts",
  "tests/contexts/installation/application/removal/remove-tool-files.unit.test.ts",
  "tests/contexts/installation/application/removal/user-scope-plugin-files.unit.test.ts",
  "tests/contexts/installation/application/shared/detect-plugin-drift-scope.unit.test.ts",
  "tests/orchestration/clean/clean-project.use-case.confirmation-and-preview.unit.test.ts",
  "tests/orchestration/clean/clean-project.use-case.native-undo-order.unit.test.ts",
  "tests/orchestration/clean/clean-user-scope.use-case.native-preflight.unit.test.ts",
  "tests/orchestration/doctor/doctor-plugin.unit.test.ts",
  "tests/setup/throwaway-profile.unit.test.ts",
];

const REAL_ENVIRONMENT =
  /^import\b[^;]*?\bfrom ["'](?:node:)?(?:fs|fs\/promises|os|child_process)["']/m;

describe("unit tests are pure", () => {
  it("sees a filesystem, a process and an os import, and not a path import", () => {
    expect(REAL_ENVIRONMENT.test('import { homedir } from "node:os";')).toBe(true);
    expect(REAL_ENVIRONMENT.test('import { readFileSync } from "fs";')).toBe(true);
    expect(REAL_ENVIRONMENT.test('import { mkdir } from "node:fs/promises";')).toBe(true);
    expect(REAL_ENVIRONMENT.test('import { join } from "node:path";')).toBe(false);
  });

  it("keeps every real-environment import out of a unit test, or on the list written down for it", () => {
    const impure = tsFilesUnder("tests").filter(
      (file) => file.endsWith(".unit.test.ts") && REAL_ENVIRONMENT.test(read(file))
    );

    expect(impure).toEqual(IMPURE_UNIT_TESTS);
  });
});
