"use strict";
// Reads the plan's phase table once; shared by the plan checks.
const { shape, cells } = require("../lib/ops.cjs");

const section = (ctx, name) => shape(ctx.text, ctx.prose, ctx.fm).sections.find((s) => s.name === name);

function phaseRows(ctx) {
  const body = section(ctx, "Phases")?.body ?? [];
  const listed = body.filter((l) => /^\|\s*\d+\s*\|/u.test(l)).length;
  const rows = body.map(cells).filter((c) => /^\d+$/u.test(c[0] ?? "") && c.length >= 4);
  return { listed, rows, line: section(ctx, "Phases")?.line ?? 1 };
}

module.exports = { section, phaseRows };
