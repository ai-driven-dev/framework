import { spawnSync } from "node:child_process";

/* What a child Node writes for one instant and one number, in its own zone and locale and in
 * English: a locale is foreign only if it writes them otherwise, whatever it is called. A locale
 * ICU has no data for keeps its name and formats as English. */
const PROBE = `
const at = new Date("2026-10-01T12:00:00Z");
const n = 1234567.5;
process.stdout.write(JSON.stringify({
  offset: at.getTimezoneOffset(),
  local: [n.toLocaleString(), at.toLocaleDateString()],
  english: [n.toLocaleString("en-US"), at.toLocaleDateString("en-US")],
}));`;

/** Why a child Node run with `env` would not see a foreign clock and locale, or `null` when it
 * would. */
export function foreignClockProblem(env) {
  const probe = spawnSync(process.execPath, ["-e", PROBE], { env, encoding: "utf8" });
  if (probe.status !== 0) return `the probe failed: ${probe.stderr.trim()}`;
  const { offset, local, english } = JSON.parse(probe.stdout);
  if (offset === 0) return "a child Node runs in UTC";
  const same = local.filter((text, n) => text === english[n]);
  if (same.length > 0) return `a child Node formats as English: ${same.join(", ")}`;
  return null;
}
