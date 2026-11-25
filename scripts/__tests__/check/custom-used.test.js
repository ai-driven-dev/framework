const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { it } = require("node:test");

const ROOT = path.resolve(__dirname, "../../..");

/** Each contract folder: its rules and its custom/ scripts. Data files beside them are not scripts and are not checked. */
function contracts() {
  const out = [{ file: path.join(ROOT, "scripts/check/contracts"), rules: fs.readdirSync(path.join(ROOT, "scripts/check/contracts")).filter((f) => f.endsWith(".json")).flatMap((f) => Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/check/contracts", f), "utf8")).rules)) }];
  for (const plugin of fs.readdirSync(path.join(ROOT, "plugins"))) {
    const skills = path.join(ROOT, "plugins", plugin, "skills");
    if (!fs.existsSync(skills)) continue;
    for (const skill of fs.readdirSync(skills)) {
      const file = path.join(skills, skill, "scripts/contract.json");
      if (fs.existsSync(file)) out.push({ file: path.dirname(file), rules: Object.values(JSON.parse(fs.readFileSync(file, "utf8")).rules) });
    }
  }
  return out;
}

it("every custom script is a rule's check or required by one", () => {
  const unused = [];
  for (const { file, rules } of contracts()) {
    const dir = path.join(file, "custom");
    if (!fs.existsSync(dir)) continue;
    const reached = new Set(rules.filter((r) => r.op === "custom").map((r) => `${r.check}.cjs`));
    let grew = true;
    while (grew) {
      grew = false;
      for (const name of [...reached]) for (const [, dep] of fs.readFileSync(path.join(dir, name), "utf8").matchAll(/require\("\.\/([^"]+\.cjs)"\)/gu)) if (!reached.has(dep)) (reached.add(dep), (grew = true));
    }
    for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".cjs"))) if (!reached.has(name)) unused.push(path.relative(ROOT, path.join(dir, name)));
  }
  assert.deepEqual(unused, []);
});
