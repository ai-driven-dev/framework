import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  foreignClockProblem,
  TELEMETRY_TESTS,
  unmatchedTestFilters,
} from "../../scripts/foreign-clock.mjs";

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The environment `pnpm test:foreign-clock` runs the telemetry tests in, with one part swapped. */
const guarded = (zone: string, locale: string): NodeJS.ProcessEnv => ({
  ...process.env,
  TZ: zone,
  LC_ALL: locale,
  LANG: locale,
});

describe("the foreign clock guard's own check", () => {
  // Windows ICU takes its locale from the system, never LC_ALL: there no locale can be accepted.
  it.skipIf(process.platform === "win32")(
    "accepts a zone far from UTC and a locale that writes numbers and dates otherwise",
    () => {
      expect(foreignClockProblem(guarded("Pacific/Kiritimati", "ar_SA.UTF-8"))).toBeNull();
    }
  );

  it("refuses a locale ICU has no data for, which formats as English whatever its name", () => {
    expect(foreignClockProblem(guarded("Pacific/Kiritimati", "xx_BOGUS.UTF-8"))).toMatch(
      /formats as English/
    );
  });

  it("refuses English", () => {
    expect(foreignClockProblem(guarded("Pacific/Kiritimati", "en_US.UTF-8"))).toMatch(
      /formats as English/
    );
  });

  it("refuses a zone the platform does not know, which runs in UTC", () => {
    expect(foreignClockProblem(guarded("Not/AZone", "ar_SA.UTF-8"))).toMatch(/UTC/);
  });
});

describe("the telemetry test filters the foreign clock guard runs", () => {
  it("each names at least one test file that exists", () => {
    expect(unmatchedTestFilters(CLI_ROOT, TELEMETRY_TESTS)).toEqual([]);
  });

  it("reports a filter that matches no test file, which vitest would silently ignore", () => {
    const root = mkdtempSync(join(tmpdir(), "foreign-clock-"));
    try {
      mkdirSync(join(root, "tests", "e2e"), { recursive: true });
      writeFileSync(join(root, "tests", "e2e", "telemetry-run.e2e.test.ts"), "");
      expect(unmatchedTestFilters(root, ["tests/e2e/telemetry-", "tests/e2e/telemetry/"])).toEqual([
        "tests/e2e/telemetry/",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
