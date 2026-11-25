"use strict";
// The sections of a challenge.md, read once per file: each `###` section with its items, and the lines outside any item. Headings are the template op's.
const HEADING = /^(#{1,6}) (.+?)\s*$/u;
const AIM = /^Aim:/u;
const ITEM = /^- /u;
const NONE = "- None";

const models = new WeakMap();

/** `{ sections, stray }`: each section `{ name, line, items, stray }`, and the lines other than an aim outside any section. */
function report(ctx) {
  if (models.has(ctx)) return models.get(ctx);
  const model = { sections: [], stray: [] };
  let current = null;
  ctx.prose.forEach((prose, index) => {
    if (!prose.trim()) return;
    const at = { line: index + 1, text: ctx.lines[index].trimEnd() };
    const heading = HEADING.exec(prose);
    if (heading) {
      current = heading[1].length === 3 ? { name: heading[2], line: at.line, items: [], stray: [] } : null;
      if (current) model.sections.push(current);
    } else if (!current) {
      if (!AIM.test(prose)) model.stray.push(at);
    } else if (ITEM.test(prose)) current.items.push(at);
    else if (/^\s/u.test(prose) && current.items.length) current.items.at(-1).text += ` ${at.text.trim()}`;
    else current.stray.push(at);
  });
  models.set(ctx, model);
  return model;
}

/** The items of every `name` section that holds findings rather than `- None`. */
const findingsOf = (ctx, name) =>
  report(ctx).sections.filter((s) => s.name === name && !s.items.some((item) => item.text.trim() === NONE)).flatMap((s) => s.items);

module.exports = { report, findingsOf, NONE };
