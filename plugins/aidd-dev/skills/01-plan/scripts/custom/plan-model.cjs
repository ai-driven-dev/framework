"use strict";
// Reads the plan's phase table; shared by the plan checks. Mirrors phase parsing in 02-implement scripts/custom/state.cjs on purpose: skills stay self-contained.
const { shape, cells } = require("../lib/ops.cjs");

const section = (ctx, name) => shape(ctx.text, ctx.prose, ctx.fm).sections.find((s) => s.name === name);

function phaseRows(ctx) {
  const phases = section(ctx, "Phases");
  const body = phases?.body ?? [];
  const listed = body.filter((l) => /^\|\s*\d+\s*\|/u.test(l)).length;
  const rows = body.map(cells).filter((c) => /^\d+$/u.test(c[0] ?? "") && c.length >= 4);
  return { listed, rows, line: phases?.line ?? 1 };
}

module.exports = { section, phaseRows };
