"use strict";
// plugins/<name>/CATALOG.md: the index of what each plugin ships, rendered by scripts/summarize-markdown.js.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SUMMARIZE = path.resolve(__dirname, "..", "..", "summarize-markdown.js");

/** The catalog of one plugin as it should be. Rendered in the OS temp dir, never in the repository; links are then rebased so they read as if written beside the real file. */
function render(plugin, name) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-"));
  try {
    const out = path.join(scratch, "CATALOG.md");
    const run = spawnSync(process.execPath, [SUMMARIZE, plugin, out, "--depth=4", "--fields=description", `--title=${name} catalog`, `--tagline=Auto-generated index of skills, agents, references and assets shipped by the \`${name}\` plugin.`], { encoding: "utf8" });
    if (run.status !== 0) throw new Error(`catalog of ${name}: ${run.stderr.trim()}`);
    return fs.readFileSync(out, "utf8").split(`](${path.relative(scratch, plugin).split(path.sep).join("/")}/`).join("](");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

module.exports = {
  name: "catalogs",
  watch: ["plugins/**"],
  run({ root, write }) {
    const plugins = path.join(root, "plugins");
    if (!fs.existsSync(plugins)) return [];
    const stale = [];
    for (const entry of fs.readdirSync(plugins, { withFileTypes: true }).filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(plugins, entry.name, "CATALOG.md");
      const text = render(path.join(plugins, entry.name), entry.name);
      if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === text) continue;
      if (write) fs.writeFileSync(file, text);
      stale.push(`plugins/${entry.name}/CATALOG.md`);
    }
    return stale;
  },
};
