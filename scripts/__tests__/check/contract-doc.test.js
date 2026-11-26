const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");

const { TOP_KEYS, RULE_KEYS } = require("../../check/engine/engine.cjs");
const { OPTIONS } = require("../../check/engine/ops.cjs");

/** The Contracts section of the architecture page names every key and op the engine accepts, and nothing else. */

const page = fs.readFileSync(path.join(__dirname, "../../../docs/ARCHITECTURE.md"), "utf8");
const section = page.split(/^## /mu).find((part) => part.startsWith("Contracts\n")) ?? "";

/** First-column names of the table whose header starts with `| <header> |`. */
function rows(header) {
  const lines = section.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`| ${header} |`));
  if (start < 0) return [];
  const out = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith("|")) break;
    out.push(/^\| `([^`]+)` \|/u.exec(line)?.[1]);
  }
  return out;
}

describe("contract format page", () => {
  it("lists every top-level key", () => assert.deepEqual(rows("Key").sort(), [...TOP_KEYS].sort()));
  it("lists every rule key", () => assert.deepEqual(rows("Rule key").sort(), [...RULE_KEYS].sort()));
  it("lists every op", () => assert.deepEqual(rows("Op").sort(), Object.keys(OPTIONS).sort()));
});
