const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const PLUGINS = path.resolve(__dirname, "../../plugins");

/** Each command handler of a hooks.json as `event: command`, with its status message. */
function handlers(config) {
  const found = [];
  for (const [event, groups] of Object.entries(config.hooks ?? {})) {
    for (const group of groups) {
      for (const handler of group.hooks ?? []) {
        if (handler.type === "command") found.push({ where: `${event}: ${handler.command}`, message: handler.statusMessage });
      }
    }
  }
  return found;
}

/** The `where` of each handler lacking a non-empty status message. */
function unnamed(config) {
  return handlers(config).filter(({ message }) => typeof message !== "string" || message.trim() === "").map(({ where }) => where);
}

function hookConfigs() {
  return fs
    .readdirSync(PLUGINS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(PLUGINS, entry.name, "hooks", "hooks.json"))
    .filter((file) => fs.existsSync(file));
}

test("the guard names a command handler with no status message, or an empty one", () => {
  const entry = (extra) => ({ hooks: { Stop: [{ hooks: [{ type: "command", command: "node a.cjs", ...extra }] }] } });
  assert.deepEqual(unnamed(entry({})), ["Stop: node a.cjs"]);
  assert.deepEqual(unnamed(entry({ statusMessage: "  " })), ["Stop: node a.cjs"]);
  assert.deepEqual(unnamed(entry({ statusMessage: "AIDD Context: check" })), []);
});

test("every command handler a plugin ships carries a status message naming its plugin", () => {
  const files = hookConfigs();
  assert.ok(files.length > 0, "no hooks.json found");
  for (const file of files) {
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.deepEqual(unnamed(config), [], `${path.relative(PLUGINS, file)} has handlers without a statusMessage`);
    for (const { message } of handlers(config)) assert.match(message, /^AIDD [A-Za-z]+: \S/u, `${path.relative(PLUGINS, file)}: "${message}"`);
  }
});
