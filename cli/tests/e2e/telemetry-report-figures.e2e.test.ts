import { describe, expect, it } from "vitest";
import { aidd, declareBranch, useReportSandbox, WINDOW } from "./telemetry-report-sandbox.js";

useReportSandbox();

/** UTC, and two zones 25 hours apart: a call at 21:00 UTC is on another local day in each. */
const ZONES = ["UTC", "Pacific/Kiritimati", "America/Adak"];
/** English, and two locales that write numbers, dates and order otherwise. */
const LOCALES = ["C", "fr_FR.UTF-8", "ar_SA.UTF-8"];

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
  it("prints the same figures, byte for byte, on the read that ingests and every one after, in any zone and locale", async () => {
    await declareBranch();
    for (const axis of ["day", "task"]) {
      const first = await report(axis, "UTC", "C");
      for (const zone of ZONES) {
        for (const locale of LOCALES) {
          const later = await report(axis, zone, locale);
          expect(later.figures, `${axis} in ${zone}, ${locale}`).toBe(first.figures);
          expect(later.facts).toMatchObject({ files_read: 0 });
        }
      }
      // The first read of the first axis opened both transcripts; the run says so, apart.
      expect(first.facts).toMatchObject({ files_read: axis === "day" ? 2 : 0 });
    }
  });
});
