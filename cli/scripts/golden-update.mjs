#!/usr/bin/env node
/* Regenerates the stored goldens: `pnpm golden:update [name]`. The name narrows the run to the
 * golden files under tests/golden whose name starts with it. */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The vitest arguments and environment that rewrite the goldens a name selects. */
export function goldenUpdateRun(name, env) {
  if (env.CI) {
    throw new Error("golden:update refuses to run in CI: a golden changes by a reviewed commit");
  }
  const args = ["run", "--project=golden"];
  if (name !== undefined) args.push(`tests/golden/${name}`);
  return { args, env: { ...env, UPDATE_GOLDEN: "1" } };
}

function main() {
  const { args, env } = goldenUpdateRun(process.argv[2], process.env);
  const run = spawnSync(
    process.execPath,
    [join(CLI_ROOT, "node_modules", "vitest", "vitest.mjs"), ...args],
    { cwd: CLI_ROOT, env, stdio: "inherit" }
  );
  process.exit(run.status ?? 1);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
