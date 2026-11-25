import { describe, expect, it } from "vitest";
import {
  aidd,
  declareBranch,
  useReportSandbox,
} from "../contexts/telemetry/testing/telemetry-report-sandbox.builder.js";
import { WINDOW } from "../contexts/telemetry/testing/telemetry-report-seed.builder.js";

useReportSandbox();

/** The baseline, and one foreign pair: a zone a day ahead of UTC with a locale that writes
 * numbers and dates otherwise. The other zones run in process, where the locale cannot vary. */
const SETTINGS = [
  { zone: "UTC", locale: "C" },
  { zone: "Pacific/Kiritimati", locale: "ar_SA.UTF-8" },
];

async function report(axis: string, zone: string, locale: string) {
  const run = await aidd(["report", ...WINDOW, "--axis", axis, "--json"], {
    TZ: zone,
    LC_ALL: locale,
    LANG: locale,
  });
  expect(run.exitCode, run.stderr).toBe(0);
  const { run: facts, ...figures } = JSON.parse(run.stdout) as Record<string, unknown>;
  return { figures: JSON.stringify(figures, null, 2), facts };
}

describe("aidd telemetry report --json", () => {
  it("prints the same figures, byte for byte, on the read that ingests and every one after, in the foreign zone and locale", async () => {
    await declareBranch();
    for (const axis of ["day", "task"]) {
      const first = await report(axis, "UTC", "C");
      for (const { zone, locale } of SETTINGS) {
        const later = await report(axis, zone, locale);
        expect(later.figures, `${axis} in ${zone}, ${locale}`).toBe(first.figures);
        expect(later.facts).toMatchObject({ files_read: 0 });
      }
      // The first read of the first axis opened both transcripts; the run says so, apart.
      expect(first.facts).toMatchObject({ files_read: axis === "day" ? 2 : 0 });
    }
  });
});
