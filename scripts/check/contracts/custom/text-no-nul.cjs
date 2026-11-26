"use strict";
// No tracked source file holds a raw NUL byte. Anchor: marketplace.json.
// A NUL makes `file` report `data` and every grep over the file return nothing, indistinguishable from an absence; the `\u0000` escape compiles to the same string.
const fs = require("node:fs");
const path = require("node:path");
const { trackedFiles } = require("./no-local-paths.cjs");

const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".cjs", ".mjs", ".json", ".md", ".yml", ".yaml"]);

module.exports = (ctx) => {
  const root = path.resolve(path.dirname(ctx.abs), "..");
  const found = [];
  for (const file of trackedFiles(root).filter((f) => TEXT_EXTENSIONS.has(path.extname(f)))) {
    let bytes;
    try {
      bytes = fs.readFileSync(path.join(root, file));
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "EISDIR") continue;
      throw error;
    }
    const at = bytes.indexOf(0);
    if (at >= 0) found.push({ file: path.relative(ctx.root, path.join(root, file)), line: bytes.subarray(0, at).toString("utf8").split("\n").length, fix: "raw NUL byte, write the \\u0000 escape instead" });
  }
  return found;
};
