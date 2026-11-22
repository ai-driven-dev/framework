const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const cli = path.resolve(__dirname, "../../cli");

// A change to the shared test kit moves no mutated source: it must not run the gated `shared`
// scope, whose mutants would all replay a suite the kit change did not touch.
test("a change to the shared test kit alone selects no mutation scope", async () => {
  const { scopesToRun } = await import(
    pathToFileURL(path.join(cli, "scripts/mutation-scopes-to-run.mjs")).href
  );
  const { scopes } = JSON.parse(fs.readFileSync(path.join(cli, "mutation-scopes.json"), "utf8"));

  assert.deepEqual(scopesToRun(["cli/tests/shared/testing/capturing-logger.fake.ts"], scopes), []);
  assert.deepEqual(scopesToRun(["cli/src/shared/domain/paths.ts"], scopes), ["shared"]);
});
