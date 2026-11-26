const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it } = require("node:test");

const ROOT = path.resolve(__dirname, "../../..");
const RECORDER = path.join(__dirname, "fired-recorder.cjs");

/** Every rule id of every contract: the repository's and each skill's. */
function ruleIds() {
  const contracts = fs.readdirSync(path.join(ROOT, "scripts/check/contracts")).filter((f) => f.endsWith(".json")).map((f) => path.join(ROOT, "scripts/check/contracts", f));
  for (const plugin of fs.readdirSync(path.join(ROOT, "plugins"))) {
    const skills = path.join(ROOT, "plugins", plugin, "skills");
    if (!fs.existsSync(skills)) continue;
    for (const skill of fs.readdirSync(skills)) {
      const file = path.join(skills, skill, "scripts/contract.json");
      if (fs.existsSync(file)) contracts.push(file);
    }
  }
  return contracts.flatMap((file) => Object.keys(JSON.parse(fs.readFileSync(file, "utf8")).rules));
}

/** The rule ids that fire on a scratch fixture while the contract suites run, the repository's own findings left out. */
function firedByFixtures() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fired-"));
  try {
    const log = path.join(dir, "fired.log");
    fs.writeFileSync(log, "");
    const suites = fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.js") && f !== path.basename(__filename)).map((f) => path.join(__dirname, f));
    suites.push(...fs.readdirSync(path.join(__dirname, "..")).filter((f) => /^validate-.*\.test\.js$/u.test(f)).map((f) => path.join(__dirname, "..", f)));
    const { NODE_TEST_CONTEXT, ...inherited } = process.env;
    const env = { ...inherited, FIRED_LOG: log, FIRED_REPO: ROOT, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require=${RECORDER}` };
    spawnSync(process.execPath, ["--test", ...suites], { cwd: ROOT, env, encoding: "utf8", maxBuffer: 1 << 28 });
    return new Set(fs.readFileSync(log, "utf8").split("\n").filter(Boolean));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("every rule fires", () => {
  it("has a fixture on which each rule of each contract fires", { timeout: 300000 }, () => {
    const fired = firedByFixtures();
    const missing = ruleIds().filter((id) => !fired.has(id));
    assert.deepEqual(missing, [], `rules no fixture makes fire: ${missing.join(", ")}`);
  });
});
