import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const [assignment, ...args] = process.argv.slice(2);
const match = assignment?.match(/^([A-Z][A-Z0-9_]*)=(.*)$/u);

if (!match || args.length === 0) {
  console.error("Usage: node scripts/run-vitest-with-env.mjs KEY=VALUE <vitest args...>");
  process.exit(2);
}

const [, key, value] = match;
const vitestCli = resolve("node_modules/vitest/vitest.mjs");
const result = spawnSync(process.execPath, [vitestCli, "run", ...args], {
  env: { ...process.env, [key]: value },
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
