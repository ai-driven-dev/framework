#!/usr/bin/env node
"use strict";
// Usage: node scripts/check/refresh-schemas.cjs
// Downloads the official Claude Code schemas again into scripts/check/contracts/schemas/official, unmodified, and dates the README.
// Manual only: never from a hook or CI. Review the diff, then run scripts/check/run.cjs: the new schemas may fail the contracts or use a keyword the json op does not read.
const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "contracts", "schemas", "official");
const SOURCES = ["claude-code-plugin-manifest", "claude-code-marketplace", "claude-code-settings"];

async function main() {
  const bodies = [];
  for (const name of SOURCES) {
    const url = `https://www.schemastore.org/${name}.json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    JSON.parse(body.toString("utf8"));
    bodies.push([name, body]);
  }
  for (const [name, body] of bodies) fs.writeFileSync(path.join(DIR, `${name}.json`), body);
  const readme = path.join(DIR, "README.md");
  fs.writeFileSync(readme, fs.readFileSync(readme, "utf8").replace(/^Retrieved: .*$/mu, `Retrieved: ${new Date().toISOString().slice(0, 10)}`));
  process.stdout.write(`refreshed ${SOURCES.length} schemas\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
