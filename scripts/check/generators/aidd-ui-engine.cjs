"use strict";
// plugins/aidd-ui/skills/*/scripts/aidd-ui/, from plugins/aidd-ui/hooks/: each skill runs its own byte-identical copy of the
// design system engine, so no skill names a path outside its folder. The hook manifest and hooks/lib/contracts/, which
// sync.cjs owns, are left out. Written by `run.cjs --fix`, from the pre-commit hook.
const fs = require("node:fs");
const path = require("node:path");

const PLUGIN = path.join("plugins", "aidd-ui");
const SOURCE = path.join(PLUGIN, "hooks");
const ENTRY = "aidd-ui.cjs";
const LIB = "lib";
const SKIPPED = path.join(LIB, "contracts");
const COPY = path.join("scripts", "aidd-ui");

const filesUnder = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => (entry.isDirectory() ? filesUnder(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))
    : [];

/** The engine files, relative to the hooks folder. */
function sources(root) {
  const hooks = path.join(root, SOURCE);
  const lib = filesUnder(path.join(hooks, LIB)).map((file) => path.relative(hooks, file)).filter((file) => !file.startsWith(SKIPPED + path.sep));
  return fs.existsSync(path.join(hooks, ENTRY)) ? [ENTRY, ...lib] : lib;
}

module.exports = {
  name: "aidd-ui-engine",
  watch: ["plugins/aidd-ui/hooks/aidd-ui.cjs", "plugins/aidd-ui/hooks/lib/**", "plugins/aidd-ui/skills/*/scripts/aidd-ui/**"],
  run({ root, write }) {
    const skills = path.join(root, PLUGIN, "skills");
    if (!fs.existsSync(skills)) return [];
    const wanted = sources(root);
    const found = [];
    const rel = (file) => path.relative(root, file).split(path.sep).join("/");
    for (const skill of fs.readdirSync(skills, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(skills, entry.name)).sort()) {
      const copy = path.join(skill, COPY);
      for (const name of wanted) {
        const source = fs.readFileSync(path.join(root, SOURCE, name));
        const file = path.join(copy, name);
        if (fs.existsSync(file) && fs.readFileSync(file).equals(source)) continue;
        found.push(rel(file));
        if (write) {
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, source);
        }
      }
      for (const file of filesUnder(copy)) {
        if (wanted.includes(path.relative(copy, file))) continue;
        found.push(rel(file));
        if (write) fs.rmSync(file);
      }
    }
    return found.sort();
  },
};
