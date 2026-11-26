const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const { load } = require("js-yaml");
const distribution = require("../marketplace-distribution.json");
const { publishableTools, readSupportRecord, toolOf } = require("../marketplace-tools.cjs");

const hostable = (id, { nativeCli = null, pluginTree = null, catalog = `.${id}/catalog.json` } = {}) => ({
  id,
  nativeCli,
  pluginTree,
  marketplace: catalog === null ? null : { catalog, manifest: `.${id}/plugin.json` },
  builds: { marketplace: {}, flat: {} },
});

test("a tool whose marketplace layout builds a catalog the host reads is publishable", () => {
  const [tool] = publishableTools([hostable("alpha", { nativeCli: "claude" })]);
  assert.deepEqual(tool, {
    id: "alpha",
    catalog: ".alpha/catalog.json",
    manifest: ".alpha/plugin.json",
    client: "claude",
    clientPackage: distribution.clients.claude,
  });
});

test("a catalog no host reads, and a layout with no catalog, are not publishable", () => {
  const record = [
    hostable("plain", { nativeCli: "claude" }),
    hostable("directory", { nativeCli: "claude", pluginTree: ".x/plugins/" }),
    hostable("bare", { nativeCli: "claude", catalog: null }),
  ];
  assert.deepEqual(publishableTools(record).map((tool) => tool.id), ["plain"]);
});

test("the client package comes from the distribution data", () => {
  assert.equal(toolOf("claude").clientPackage, distribution.clients.claude);
});

test("a tool with a catalog but no native client to verify it is not publishable", () => {
  assert.deepEqual(publishableTools([hostable("clientless")]), []);
});

test("an id absent from the registry is not publishable", () => {
  assert.equal(toolOf("no-such-tool"), undefined);
});

const record = readSupportRecord();
const withMarketplace = record.filter((tool) => tool.builds.marketplace);
const published = new Set(publishableTools(record).map((tool) => tool.id));

test("every tool with a marketplace layout is published or has a stated reason it is not", () => {
  const unaccounted = withMarketplace
    .map((tool) => tool.id)
    .filter((id) => !published.has(id) && !distribution.notHosted.includes(id));
  assert.deepEqual(unaccounted, []);
});

test("a stated reason names a tool that really is not published", () => {
  const stale = distribution.notHosted.filter(
    (id) => published.has(id) || !withMarketplace.some((tool) => tool.id === id)
  );
  assert.deepEqual(stale, []);
});

test("every published tool has its release ZIP built and its client pinned", () => {
  const workflow = load(readFileSync(resolve(__dirname, "../../.github/workflows/ci.yml"), "utf8"));
  const built = workflow.jobs["build-per-tool"].strategy.matrix.include
    .filter((entry) => entry.mode === "marketplace")
    .map((entry) => entry.tool);
  for (const tool of publishableTools(record)) {
    assert.ok(built.includes(tool.id), `${tool.id} has no marketplace ZIP in build-per-tool`);
    assert.ok(tool.clientPackage, `${tool.id} client is not pinned`);
  }
});

test("the workflow publishes the tools the registry lists, and no other list", () => {
  const workflow = load(readFileSync(resolve(__dirname, "../../.github/workflows/ci.yml"), "utf8"));
  assert.match(workflow.jobs["publish-marketplace"].strategy.matrix, /fromJSON\(needs\.marketplace-tools\.outputs\.matrix\)/);
});
