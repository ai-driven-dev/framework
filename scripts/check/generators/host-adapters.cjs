"use strict";
// cli/assets/hooks-runtime/host-<tool>.cjs, from cli/assets/hooks-runtime/parts/ by the rules cli/scripts/host-adapter-parts.mjs
// owns. The adapters stay committed and standalone: sync.cjs copies host-claude.cjs into the plugins. Written by
// `run.cjs --fix`, from the pre-commit hook.
const fs = require("node:fs");
const path = require("node:path");
const { adapterFile, isTemplate, partFile, partNamesIn, partText, splitTemplate } = require("../../../cli/scripts/host-adapter-parts.mjs");

const RUNTIME = path.join("cli", "assets", "hooks-runtime");

const rel = (file) => file.split(path.sep).join("/");

/** The adapter the template `name` generates, or `{ problem }` naming the first part it names that no file holds. */
function generate(root, name) {
  const template = path.join(RUNTIME, partFile(name));
  const pieces = splitTemplate(fs.readFileSync(path.join(root, template), "utf8"));
  let missing;
  const generated = pieces.map((piece, index) => {
    if (index % 2 === 0) return piece;
    const part = path.join(RUNTIME, partFile(piece));
    if (fs.existsSync(path.join(root, part))) return partText(fs.readFileSync(path.join(root, part), "utf8"));
    missing ??= `${rel(template)} names part ${piece}, which ${rel(part)} does not hold`;
    return "";
  });
  return missing === undefined ? generated.join("") : { problem: missing };
}

module.exports = {
  name: "host-adapters",
  watch: ["cli/assets/hooks-runtime/**", "cli/scripts/host-adapter-parts.mjs"],
  run({ root, write }) {
    const found = [];
    for (const name of partNamesIn(path.join(root, RUNTIME)).filter(isTemplate)) {
      const generated = generate(root, name);
      if (typeof generated !== "string") {
        found.push(generated);
        continue;
      }
      const adapter = path.join(RUNTIME, adapterFile(name));
      const file = path.join(root, adapter);
      if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === generated) continue;
      found.push(rel(adapter));
      if (write) fs.writeFileSync(file, generated);
    }
    return found;
  },
};
