"use strict";
// The gaps of a shadow report, read once per file: each category under "## Gaps by Category", its parts, its gap lines and the lines that are neither. Headings are the template op's.
const fs = require("node:fs");
const path = require("node:path");

const HEADING = /^(#{1,6}) (.+?)\s*$/u;
const GAP = /^\[([^\]]*)\] (.*)$/u;
const SNIPPET = /^>/u;
const GAPS = "Gaps by Category";
const CLOSED = "Closed";

const models = new WeakMap();

/** The locked categories, severities and question forms, kept beside the checks so the plugin hook carries them too. */
const locked = () => JSON.parse(fs.readFileSync(path.join(__dirname, "locked-sets.json"), "utf8"));

/** `{ categories, gaps, stray }`: each category `{ name, line }`, each gap `{ line, text, severity, probe, category, part }`, and the stray lines inside "Gaps by Category". */
function report(ctx) {
  if (models.has(ctx)) return models.get(ctx);
  const model = { categories: [], gaps: [], stray: [] };
  let inGaps = false;
  let category = null;
  let part = null;
  let last = null;
  ctx.prose.forEach((prose, index) => {
    if (!prose.trim()) return;
    const at = { line: index + 1, text: ctx.lines[index].trimEnd() };
    const heading = HEADING.exec(prose);
    if (heading) {
      const level = heading[1].length;
      if (level <= 2) {
        inGaps = level === 2 && heading[2] === GAPS;
        category = null;
      } else if (inGaps && level === 3) {
        category = { name: heading[2], line: at.line };
        model.categories.push(category);
        part = null;
      } else if (inGaps && level === 4) part = heading[2];
      last = null;
      return;
    }
    if (!inGaps) return;
    const gap = GAP.exec(prose);
    if (gap && category) {
      last = { ...at, severity: gap[1], probe: gap[2].trim(), category: category.name, part };
      model.gaps.push(last);
    } else if (SNIPPET.test(prose) && last) return;
    else {
      model.stray.push(at);
      last = null;
    }
  });
  models.set(ctx, model);
  return model;
}

/** The gaps counted in the totals and the status: every gap but the closed ones. */
const inScope = (ctx) => report(ctx).gaps.filter((gap) => gap.part !== CLOSED);

module.exports = { report, inScope, locked };
