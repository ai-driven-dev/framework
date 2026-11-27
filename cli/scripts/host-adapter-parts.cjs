"use strict";
// A host adapter, `assets/hooks-runtime/host-<tool>.cjs`, is its template `parts/host-<tool>.js.txt` with every
// `// @part <name>` line replaced by `parts/<name>.js.txt`. The repository's host-adapters generator writes the
// committed adapters from these rules; the bundle joins the same parts at load, so each part ships once.
const fs = require("node:fs");
const path = require("node:path");

const PART_LINE = /^\/\/ @part (\S+)$/mu;

/** A template cut at its part lines: even entries are its own text, odd entries the names of the parts. */
function splitTemplate(text) {
  return text.split(PART_LINE);
}

/** The adapter a template file name generates, and back. */
const adapterOf = (template) => `${path.basename(template, ".js.txt")}.cjs`;
const templateOf = (adapter) => `${path.basename(adapter, ".cjs")}.js.txt`;

/** A part as an adapter holds it: the line break that closed the template's part line closes it. */
function partText(content) {
  return content.replace(/\n$/u, "");
}

const ADAPTER = /[\\/]hooks-runtime[\\/]host-[^\\/]+\.cjs$/;
const PART = /[\\/]hooks-runtime[\\/]parts[\\/][^\\/]+\.js\.txt$/;

/** The esbuild plugin that loads each adapter as its template joined to its parts, one module per part. */
const joinedHostAdapters = {
  name: "joined-host-adapters",
  setup(build) {
    build.onLoad({ filter: ADAPTER }, ({ path: adapter }) => {
      const template = path.join(path.dirname(adapter), "parts", templateOf(adapter));
      const imports = [];
      const pieces = splitTemplate(fs.readFileSync(template, "utf8")).map((piece, index) => {
        if (index % 2 === 0) return JSON.stringify(piece);
        imports.push(`import part${index} from ${JSON.stringify(`./parts/${piece}.js.txt`)};`);
        return `part${index}`;
      });
      return {
        contents: `${imports.join("\n")}\nexport default ${pieces.join(" + ")};\n`,
        loader: "js",
        resolveDir: path.dirname(adapter),
        watchFiles: [template],
      };
    });
    build.onLoad({ filter: PART }, ({ path: part }) => ({
      contents: partText(fs.readFileSync(part, "utf8")),
      loader: "text",
    }));
  },
};

module.exports = { adapterOf, splitTemplate, partText, joinedHostAdapters };
