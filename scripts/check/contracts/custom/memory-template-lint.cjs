"use strict";
// A memory template, put in a bank under another name, raises what its kind allows: the README template none, a memory template only its questions (M3 on a `{{` line).
// Anchor: each file of the skill's assets/templates.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const isReadme = (abs) => path.basename(abs) === "README.md";

module.exports = (ctx) => {
  const { lintFile } = require(path.join(ctx.root, "scripts/lib/memory-lint.cjs"));
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "template-probe-"));
  try {
    fs.mkdirSync(path.join(scratch, "aidd_docs/memory"), { recursive: true });
    const probe = isReadme(ctx.abs) ? "readme-probe.md" : path.basename(ctx.abs);
    fs.writeFileSync(path.join(scratch, "aidd_docs/memory", probe), ctx.text);
    const errors = lintFile(scratch, `aidd_docs/memory/${probe}`).filter((problem) => problem.severity === "error");
    if (isReadme(ctx.abs)) return errors.map((error) => ({ line: error.line, offending: error.excerpt, fix: `${error.rule}: ${error.message}` }));
    const found = errors
      .filter((error) => error.rule !== "M3" || !ctx.lines[error.line - 1].includes("{{"))
      .map((error) => ({ line: error.line, offending: error.excerpt, fix: `${error.rule}: ${error.message}, only a {{question}} may raise an error` }));
    if (errors.length === 0) found.push({ line: 1, fix: "the template asks no {{question}}, add the questions the writer answers" });
    return found;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
};
