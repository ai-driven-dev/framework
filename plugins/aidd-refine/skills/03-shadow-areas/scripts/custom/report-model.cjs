"use strict";
// A shadow report read once per file: its category sections, its gaps with their quotes, and the lines that are neither.
const CATEGORIES = ["contradiction", "missing actor", "missing dependency", "missing failure mode", "missing edge case", "ambiguous term", "missing acceptance criterion", "unstated assumption"];
const CLOSED = "Closed";

const SECTION = /^## (.+?)\s*$/u;
const GAP = /^- (.+?)\s*$/u;
const QUOTE = /^\s+> (.+?)\s*$/u;

const models = new WeakMap();

/** `{ sections, gaps, stray }`: each section `{ name, line }`, each gap `{ line, text, question, category, closed, quotes }`, each quote `{ line, text }`. */
function report(ctx) {
  if (models.has(ctx)) return models.get(ctx);
  const model = { sections: [], gaps: [], stray: [] };
  let section = null;
  let gap = null;
  ctx.prose.forEach((prose, index) => {
    if (!prose.trim() || /^# /u.test(prose)) return;
    const raw = ctx.lines[index];
    const at = { line: index + 1, text: raw.trimEnd() };
    const heading = SECTION.exec(prose);
    const item = GAP.test(prose) && GAP.exec(raw);
    const quote = QUOTE.test(prose) && QUOTE.exec(raw);
    if (heading) {
      section = { name: heading[1], line: at.line };
      model.sections.push(section);
      gap = null;
    } else if (item && section) {
      gap = { ...at, question: item[1], category: section.name, closed: section.name === CLOSED, quotes: [] };
      model.gaps.push(gap);
    } else if (quote && gap) gap.quotes.push({ line: at.line, text: quote[1] });
    else model.stray.push(at);
  });
  models.set(ctx, model);
  return model;
}

/** The gaps still open: every gap outside Closed. */
const open = (ctx) => report(ctx).gaps.filter((gap) => !gap.closed);

/** Text with its whitespace runs collapsed, so a quote matches across line breaks. */
const flat = (text) => text.replace(/\s+/gu, " ").trim();

module.exports = { CATEGORIES, CLOSED, report, open, flat };
