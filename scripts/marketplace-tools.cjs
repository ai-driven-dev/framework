#!/usr/bin/env node
// The one list of tools whose marketplace is published, read from the CLI's stored tool-support
// record, never kept by hand. Run as a script it prints the workflow matrix for `fromJSON`.
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const distribution = require("./marketplace-distribution.json");

function readSupportRecord(root = join(__dirname, "..")) {
  return JSON.parse(readFileSync(join(root, "cli/tests/golden/snapshots/tool-support/surface.json"), "utf8"));
}

/** A tool with a plugin tree (Antigravity) writes a catalog no host reads, and a layout that builds
 * none (Kimi) has nothing to host. `notHosted` says why each unpublished tool is, and keeps one out. */
function publishableTools(record = readSupportRecord()) {
  return record
    .filter((tool) => tool.marketplace !== null && tool.pluginTree === null && !distribution.notHosted[tool.id])
    .map((tool) => ({
      id: tool.id,
      catalog: tool.marketplace.catalog,
      manifest: tool.marketplace.manifest,
      client: tool.nativeCli,
      clientPackage: distribution.clients[tool.nativeCli] ?? null,
    }));
}

function toolOf(id, record) {
  return publishableTools(record).find((tool) => tool.id === id);
}

module.exports = { publishableTools, readSupportRecord, toolOf };

if (require.main === module) {
  const include = publishableTools().map(({ id, clientPackage }) => ({
    tool: id,
    clientPackage: clientPackage ?? "",
  }));
  console.log(`matrix=${JSON.stringify({ include })}`);
}
