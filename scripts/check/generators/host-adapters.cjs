"use strict";
// cli/assets/hooks-runtime/host-<tool>.cjs, from cli/assets/hooks-runtime/parts/ by the rules cli/scripts/host-adapter-parts.cjs
// owns. The adapters stay committed and standalone: sync.cjs copies host-claude.cjs into the plugins. Written by
// `run.cjs --fix`, from the pre-commit hook.
const fs = require("node:fs");
const path = require("node:path");
const { adapterOf, partText, splitTemplate } = require("../../../cli/scripts/host-adapter-parts.cjs");

const RUNTIME = path.join("cli", "assets", "hooks-runtime");
const PARTS = path.join(RUNTIME, "parts");
const TEMPLATE = /^host-.+\.js\.txt$/u;

const rel = (file) => file.split(path.sep).join("/");

/** The adapter a template generates, or `{ problem }` naming the first part it names that no file holds. */
function generate(root, template) {
  const pieces = splitTemplate(fs.readFileSync(path.join(root, PARTS, template), "utf8"));
  let missing;
  const generated = pieces.map((piece, index) => {
    if (index % 2 === 0) return piece;
    const part = path.join(PARTS, `${piece}.js.txt`);
    if (fs.existsSync(path.join(root, part))) return partText(fs.readFileSync(path.join(root, part), "utf8"));
    missing ??= `${rel(path.join(PARTS, template))} names part ${piece}, which ${rel(part)} does not hold`;
    return "";
  });
  return missing === undefined ? generated.join("") : { problem: missing };
}

module.exports = {
  name: "host-adapters",
  watch: ["cli/assets/hooks-runtime/**", "cli/scripts/host-adapter-parts.cjs"],
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
      const adapter = path.join(RUNTIME, adapterOf(template));
      const file = path.join(root, adapter);
      if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === generated) continue;
      found.push(rel(adapter));
      if (write) fs.writeFileSync(file, generated);
    }
    return found;
  },
};
