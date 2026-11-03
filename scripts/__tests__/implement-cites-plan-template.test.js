const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");

const SKILLS_DIR = path.resolve(__dirname, "../../plugins/aidd-dev/skills");
const IMPLEMENT_ACTIONS_DIR = path.join(SKILLS_DIR, "02-implement", "actions");
const PLAN_ASSETS_DIR = path.join(SKILLS_DIR, "01-plan", "assets");

/** Names of the plan's own structure that implement's actions rely on. */
const CITED_FROM_PLAN = ["Test Scope"];

const readAll = (dir) =>
  fs
    .readdirSync(dir)
    .map((file) => fs.readFileSync(path.join(dir, file), "utf8"))
    .join("\n");

describe("implement cites the plan's structure by names the plan template holds", () => {
  const implementText = readAll(IMPLEMENT_ACTIONS_DIR);
  const planTemplates = readAll(PLAN_ASSETS_DIR);

  CITED_FROM_PLAN.forEach((name) => {
    it(`${name}: cited by an implement action`, () => {
      assert.ok(implementText.includes(name), `no implement action cites "${name}", drop it from this list`);
    });

    it(`${name}: held by a plan template`, () => {
      assert.ok(planTemplates.includes(name), `the plan templates no longer hold "${name}", implement cites it`);
    });
  });
});
