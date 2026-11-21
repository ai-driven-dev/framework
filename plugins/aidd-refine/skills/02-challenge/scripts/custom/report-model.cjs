"use strict";
// The rounds of a challenge.md, read once per file: each with its aim, its sections, their items, and the lines that are neither.
const ROUND = /^# Round (\d+)\s*$/u;
const SECTION = /^# (.+?)\s*$/u;
const AIM = /^Aim:(.*)$/u;
const ITEM = /^- /u;

const models = new WeakMap();

/** `{ before, rounds }`: content lines before any round, and each round `{ number, line, aim, sections, stray }`. */
function report(ctx) {
  if (models.has(ctx)) return models.get(ctx);
  const model = { before: [], rounds: [] };
  ctx.prose.forEach((prose, index) => {
    if (!prose.trim()) return;
    const at = { line: index + 1, text: ctx.lines[index].trimEnd() };
    const round = ROUND.exec(prose);
    const current = model.rounds.at(-1);
    if (round) model.rounds.push({ number: Number(round[1]), line: at.line, aim: null, sections: [], stray: [] });
    else if (!current) model.before.push(at);
    else if (current.aim === null && current.sections.length === 0 && AIM.test(prose)) current.aim = { ...at, value: AIM.exec(at.text)[1].trim() };
    else if (SECTION.test(prose)) current.sections.push({ name: SECTION.exec(prose)[1], line: at.line, items: [] });
    else if (!current.sections.length) current.stray.push(at);
    else if (ITEM.test(prose)) current.sections.at(-1).items.push({ ...at });
    else if (/^\s/u.test(prose) && current.sections.at(-1).items.length) current.sections.at(-1).items.at(-1).text += ` ${at.text.trim()}`;
    else current.sections.at(-1).stray = [...(current.sections.at(-1).stray ?? []), at];
  });
  models.set(ctx, model);
  return model;
}

const SECTIONS = ["Deal breakers", "To decide", "Suggestions", "Holds"];
const NONE = "- None";

/** Each section of each round that holds findings: not empty and not `- None`. */
const findingsOf = (ctx, name) =>
  report(ctx).rounds.flatMap((round) => round.sections.filter((s) => s.name === name && !s.items.some((item) => item.text.trim() === NONE)).flatMap((s) => s.items.map((item) => ({ round, item }))));

module.exports = { report, findingsOf, SECTIONS, NONE };
