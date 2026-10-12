const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const yaml = require("js-yaml");

const root = path.resolve(__dirname, "../..");

// Lefthook on Windows hands each job to `sh -c` through a command line it builds by hand,
// escaping nothing (#948): a `"` in a `run` closes the argument, and sh gets a truncated
// script. A `'` is safe, and so is a script file the run line only names.
test("no run in lefthook.yml holds a double quote", () => {
  const config = yaml.load(fs.readFileSync(path.join(root, "lefthook.yml"), "utf8"));
  const offenders = [];
  let scanned = 0;

  for (const [hook, def] of Object.entries(config)) {
    for (const [name, command] of Object.entries(def?.commands ?? {})) {
      scanned++;
      if (String(command.run ?? "").includes('"')) offenders.push(`${hook}/${name}`);
    }
  }

  // Zero means the hooks moved to a form this guard does not read, such as `jobs:`.
  assert.ok(scanned > 0, "no `commands:` run found in lefthook.yml");
  assert.deepEqual(offenders, []);
});
