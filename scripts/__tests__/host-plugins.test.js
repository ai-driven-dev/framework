const assert = require("node:assert/strict");
const { test } = require("node:test");
const { installedPlugins, json } = require("../lib/host-plugins.cjs");

test("Claude Code lists a plugin as id, scope, enabled and version", () => {
  const text = JSON.stringify([{ id: "aidd-context@aidd-marketplace", scope: "user", enabled: true, version: "2.11.0" }]);
  assert.deepEqual(installedPlugins("claude", text), [
    { name: "aidd-context", marketplace: "aidd-marketplace", scope: "user", enabled: true, version: "2.11.0" },
  ]);
});

test("Codex lists installed plugins under `installed`, enabled only when installed and enabled", () => {
  const entry = { name: "aidd-context", marketplaceName: "aidd-marketplace", version: "2.11.0" };
  const text = JSON.stringify({
    installed: [
      { ...entry, installed: true, enabled: true },
      { ...entry, name: "aidd-dev", installed: false, enabled: true },
    ],
    available: [],
  });
  assert.deepEqual(
    installedPlugins("codex", text).map(({ name, marketplace, enabled, version }) => [name, marketplace, enabled, version]),
    [
      ["aidd-context", "aidd-marketplace", true, "2.11.0"],
      ["aidd-dev", "aidd-marketplace", false, "2.11.0"],
    ]
  );
});

test("Copilot lists a plugin as name, marketplace, enabled and version", () => {
  const text = JSON.stringify([{ name: "aidd-context", marketplace: "aidd-marketplace", enabled: true, version: "2.11.0" }]);
  assert.deepEqual(installedPlugins("copilot", text), [
    { name: "aidd-context", marketplace: "aidd-marketplace", enabled: true, version: "2.11.0" },
  ]);
});

test("an answer that is not JSON, or not the expected shape, lists nothing", () => {
  for (const host of ["claude", "codex", "copilot"]) {
    assert.deepEqual(installedPlugins(host, "not json"), []);
    assert.deepEqual(installedPlugins(host, null), []);
    assert.deepEqual(installedPlugins(host, "{}"), []);
  }
});

test("json gives null where the text is not JSON", () => {
  assert.equal(json("{"), null);
  assert.deepEqual(json('{"a":1}'), { a: 1 });
});
