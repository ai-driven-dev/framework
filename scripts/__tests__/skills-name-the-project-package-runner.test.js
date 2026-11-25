const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");

const { markdownUnder } = require("../lib/architecture-scan");

const ROOT = path.resolve(__dirname, "../..");
const PLUGINS = path.join(ROOT, "plugins");

/**
 * A skill never assumes the package runner: a project may use npx, pnpm dlx or bunx, and the
 * lockfile says which. A skill that needs one names it once, as the project's package runner,
 * on the line that lists the alternatives. A bare `npx` anywhere else hardcodes a runner.
 *
 * Limit: only `npx` has been observed hardcoded, so only `npx` is checked; a line naming
 * `pnpm dlx` is taken to be the declaring sentence. The whole aidd-qa plugin is owned by the
 * pending QA change and is left to it.
 */

const HANDLED_ELSEWHERE = "plugins/aidd-qa/";

const NPX = /\bnpx\b/u;
const NAMES_THE_ALTERNATIVES = /pnpm dlx/u;

describe("skills name the project's package runner", () => {
  it("hardcodes npx nowhere outside the line that lists the runners", () => {
    const offenders = [];
    for (const relative of markdownUnder(PLUGINS, ROOT, [])) {
      if (relative.startsWith(HANDLED_ELSEWHERE) || relative.endsWith("/CATALOG.md")) continue;
      fs.readFileSync(path.join(ROOT, relative), "utf8")
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
