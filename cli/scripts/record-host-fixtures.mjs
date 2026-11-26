#!/usr/bin/env node
/* Records a host's plugin and marketplace behaviour: `pnpm record:host <host>`. Runs the real
 * binary in a throwaway HOME and writes tests/fixtures/hosts/<host>-<version>/observations.json.
 * Never part of a test run: re-record when a host changes. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RECORDED_HOSTS, recordHost } from "./host-recording.mjs";

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function main() {
  const host = process.argv[2];
  if (host === undefined || !RECORDED_HOSTS.includes(host)) {
    console.error(`usage: pnpm record:host <${RECORDED_HOSTS.join("|")}>`);
    process.exit(2);
  }
  const recording = recordHost(host);
  const dir = join(CLI_ROOT, "tests", "fixtures", "hosts", `${host}-${recording.version}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "observations.json"), `${JSON.stringify(recording, null, 2)}\n`);
  console.log(`recorded ${recording.steps.length} steps into ${dir}`);
}

main();
