const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { checkOrthogonality } = require("../lib/architecture-rules.js");

const ROOT = path.resolve(__dirname, "../..");
const DOC = path.join(ROOT, "docs/ARCHITECTURE.md");

/**
 * `docs/ARCHITECTURE.md` describes the tree in two of its tables: the bundled hooks each plugin
 * declares, and the plugin roster. Both were right when written and nothing compared them to the
 * tree afterwards, which is how a document goes quietly wrong. These tests are that comparison.
 *
 * Tables are found by their header cells and read by column name, never by position, so adding a
 * column, reordering two tables under one heading or leaving a blank line between rows changes
 * nothing here. What must not change is a header cell this file names.
 */

const CELL_SEPARATOR = /(?<!\\)\|/;

function rowCells(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(CELL_SEPARATOR)
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-+:?$/.test(cell));
}

/**
 * Every table in the file, as `{ header, rows }`. A blank line does not end a table, because a
 * table split for grouping is still one table. Any other non-row line does, because otherwise two
 * tables separated by prose read as one.
 */
function tables() {
  const found = [];
  let current = null;

  for (const line of fs.readFileSync(DOC, "utf8").split("\n")) {
    if (!line.trim().startsWith("|")) {
      if (line.trim() !== "") current = null;
      continue;
    }
    const cells = rowCells(line);
    if (isSeparatorRow(cells)) continue;
    if (current === null) {
      current = { header: cells, rows: [] };
      found.push(current);
    } else {
      current.rows.push(cells);
    }
  }
  return found;
}

/** The one table whose header holds every name given. Never two, never none. */
function tableWithColumns(...names) {
  const matches = tables().filter((table) =>
    names.every((name) => table.header.some((cell) => cell.toLowerCase() === name.toLowerCase()))
  );
  assert.equal(
    matches.length,
    1,
    `expected exactly one table in ARCHITECTURE.md with columns ${names.join(", ")}, found ${matches.length}`
  );
  return matches[0];
}

function column(table, name) {
  const at = table.header.findIndex((cell) => cell.toLowerCase() === name.toLowerCase());
  return (cells) => cells[at] ?? "";
}

/** `` `aidd-ui` 🚧 `` and `` `SessionStart` · `Stop` `` both mean the backticked tokens. */
function backticked(cell) {
  return [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

function onlyBacktickedName(cell, where) {
  const names = backticked(cell);
  assert.equal(names.length, 1, `${where}: expected one backticked name, got ${JSON.stringify(cell)}`);
  return names[0];
}

function pluginDirectories() {
  return fs
    .readdirSync(path.join(ROOT, "plugins"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function declaredHookEvents(plugin) {
  const manifest = path.join(ROOT, "plugins", plugin, "hooks/hooks.json");
  if (!fs.existsSync(manifest)) return null;
  return Object.keys(JSON.parse(fs.readFileSync(manifest, "utf8")).hooks ?? {}).sort();
}

const hooksTable = () => tableWithColumns("Plugin", "Event", "Runs");
const concernsTable = () => tableWithColumns("Plugin", "Concern", "Layer");

test("the bundled hooks table names every plugin that declares hooks, and no other", () => {
  const table = hooksTable();
  const plugin = column(table, "Plugin");
  const documented = table.rows.map((cells) => onlyBacktickedName(plugin(cells), "hooks table")).sort();
  assert.deepEqual(documented, pluginDirectories().filter((name) => declaredHookEvents(name) !== null));
});

test("the bundled hooks table names the events each plugin actually declares", () => {
  const table = hooksTable();
  const plugin = column(table, "Plugin");
  const event = column(table, "Event");
  for (const cells of table.rows) {
    const name = onlyBacktickedName(plugin(cells), "hooks table");
    assert.deepEqual(
      backticked(event(cells)).sort(),
      declaredHookEvents(name),
      `${name}: the table and plugins/${name}/hooks/hooks.json disagree`
    );
  }
});

test("the bundled hooks table names a script that exists", () => {
  // Without this the table can point at a deleted hook and still read as current.
  const table = hooksTable();
  const plugin = column(table, "Plugin");
  const runs = column(table, "Runs");
  for (const cells of table.rows) {
    const name = onlyBacktickedName(plugin(cells), "hooks table");
    const script = onlyBacktickedName(runs(cells), `hooks table, ${name} Runs cell`);
    const full = path.join(ROOT, "plugins", name, script);
    assert.ok(fs.existsSync(full), `plugins/${name}/${script} is named in ARCHITECTURE.md and does not exist`);
  }
});

test("the plugin concerns table has one row per plugin in the tree", () => {
  const table = concernsTable();
  const plugin = column(table, "Plugin");
  const documented = table.rows.map((cells) => onlyBacktickedName(plugin(cells), "concerns table")).sort();
  assert.deepEqual(documented, pluginDirectories());
});

/**
 * Rule one has two holes, both deliberate, both in `isExemptFromOrthogonality`. The 00-onboard one
 * is load-bearing only while that skill still hardcodes the addresses it hands a person to type.
 * Once it resolves its providers at runtime the hole protects nothing and should go, and nothing
 * else would say so.
 */
test("the 00-onboard exemption still protects something", () => {
  const skillDir = path.join(ROOT, "plugins/aidd-context/skills/00-onboard");
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".md")) files.push(full);
    }
  };
  walk(skillDir);

  // Judged under a path the exemption does not cover, so the rule speaks instead of skipping.
  const probePath = "plugins/aidd-context/skills/99-exemption-probe/SKILL.md";
  const wouldViolate = files.filter(
    (file) => checkOrthogonality(probePath, fs.readFileSync(file, "utf8")).length > 0
  );

  assert.ok(
    wouldViolate.length > 0,
    "00-onboard no longer hardcodes a sibling address. Delete ONBOARD_EXEMPT_PREFIX from " +
      "scripts/lib/architecture-rules.js, its exemption bullet in docs/ARCHITECTURE.md, and this test."
  );
});
