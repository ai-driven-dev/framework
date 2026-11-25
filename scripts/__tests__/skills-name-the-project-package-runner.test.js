const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const PLUGINS = path.join(ROOT, "plugins");

/**
 * A skill never assumes the package runner: a project may use npx, pnpm dlx or bunx, and the
 * lockfile says which. A skill that needs one names it once, as the project's package runner,
 * on the line that lists the alternatives. A bare `npx` anywhere else hardcodes a runner.
 *
 * The browser QA files are owned by the pending QA change and are left to it.
 */

const HANDLED_ELSEWHERE = new Set([
  "plugins/aidd-qa/skills/01-acceptance-qa/actions/02-prerequisites.md",
  "plugins/aidd-qa/skills/01-acceptance-qa/references/interface-browser-playwright-cli.md",
]);

const NPX = /\bnpx\b/u;
const NAMES_THE_ALTERNATIVES = /pnpm dlx/u;

function markdownUnder(directory, found = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) markdownUnder(full, found);
    else if (entry.name.endsWith(".md") && entry.name !== "CATALOG.md") found.push(full);
  }
  return found;
}

describe("skills name the project's package runner", () => {
  it("hardcodes npx nowhere outside the line that lists the runners", () => {
    const offenders = [];
    for (const file of markdownUnder(PLUGINS)) {
      const relative = path.relative(ROOT, file).split(path.sep).join("/");
      if (HANDLED_ELSEWHERE.has(relative)) continue;
      fs.readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (NPX.test(line) && !NAMES_THE_ALTERNATIVES.test(line)) {
            offenders.push(`${relative}:${index + 1}: ${line.trim()}`);
          }
        });
    }
    assert.deepEqual(offenders, []);
  });
});
