"use strict";
// cli/assets/hooks-runtime/host-<tool>.cjs, from cli/assets/hooks-runtime/parts/: each adapter is its template,
// parts/host-<tool>.js.txt, with every `// @part <name>` line replaced by parts/<name>.js.txt, so a helper two hosts
// share is written once. The adapters stay committed and standalone: the CLI imports them as text and sync.cjs copies
// host-claude.cjs into the plugins. Written by `run.cjs --fix`, from the pre-commit hook.
const fs = require("node:fs");
const path = require("node:path");

const RUNTIME = path.join("cli", "assets", "hooks-runtime");
const PARTS = path.join(RUNTIME, "parts");
const TEMPLATE = /^host-.+\.js\.txt$/u;
const PART_LINE = /^\/\/ @part (\S+)$/gmu;

const rel = (file) => file.split(path.sep).join("/");

/** The adapter a template generates, or `{ problem }` naming the first part it names that no file holds. */
function generate(root, template) {
  const text = fs.readFileSync(path.join(root, PARTS, template), "utf8");
  let missing;
  const generated = text.replace(PART_LINE, (line, name) => {
    const part = path.join(PARTS, `${name}.js.txt`);
    if (!fs.existsSync(path.join(root, part))) {
      missing ??= `${rel(path.join(PARTS, template))} names part ${name}, which ${rel(part)} does not hold`;
      return line;
    }
    return fs.readFileSync(path.join(root, part), "utf8").replace(/\n$/u, "");
  });
  return missing === undefined ? generated : { problem: missing };
}

module.exports = {
  name: "host-adapters",
  watch: ["cli/assets/hooks-runtime/**"],
  run({ root, write }) {
    const parts = path.join(root, PARTS);
    if (!fs.existsSync(parts)) return [];
    const found = [];
    for (const template of fs.readdirSync(parts).filter((name) => TEMPLATE.test(name)).sort()) {
      const generated = generate(root, template);
      if (typeof generated !== "string") {
        found.push(generated);
        continue;
      }
      const adapter = path.join(RUNTIME, template.replace(/\.js\.txt$/u, ".cjs"));
      const file = path.join(root, adapter);
      if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === generated) continue;
      found.push(rel(adapter));
      if (write) fs.writeFileSync(file, generated);
    }
    return found;
  },
};
