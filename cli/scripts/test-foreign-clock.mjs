#!/usr/bin/env node
/* Runs the telemetry tests with the clock far from UTC and the locale far from English, so code
 * that reads the machine's zone or language fails here instead of passing wherever CI runs. A
 * test that compares across zones sets `TZ` itself; this catches the ones that do not, and the
 * locale, which a process cannot change once started. */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { foreignClockProblem } from "./foreign-clock.mjs";

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** UTC+14, the farthest ahead: a call before 10:00 UTC is on the next local day. */
const ZONE = "Pacific/Kiritimati";
/** Arabic digits and separators, right to left. */
const LOCALE = "ar_SA.UTF-8";
const TESTS = [
  "tests/contexts/telemetry",
  "tests/presentation/commands/telemetry",
  "tests/presentation/display/telemetry",
  "tests/e2e/telemetry",
];

const env = { ...process.env, TZ: ZONE, LC_ALL: LOCALE, LANG: LOCALE };

// A zone or locale the platform ignores would run the tests in UTC and English, and pass.
const problem = foreignClockProblem(env);
if (problem !== null) {
  console.error(
    `Under TZ=${ZONE} LC_ALL=${LOCALE}, ${problem}: this guard would prove nothing here.`
  );
  process.exit(1);
}
console.log(`Telemetry tests under TZ=${ZONE} and LC_ALL=${LOCALE}, both seen by Node`);

const run = spawnSync(
  process.execPath,
  [join(CLI_ROOT, "node_modules", "vitest", "vitest.mjs"), "run", ...TESTS],
  { cwd: CLI_ROOT, env, stdio: "inherit" }
);
process.exit(run.status ?? 1);
