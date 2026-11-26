"use strict";
// Under "Gaps by Category" stand only gap lines and their snippets; each gap has a locked severity and a probe in the locked form, and a part lists blocker, then major, then minor.
const { report, locked } = require("./report-model.cjs");

module.exports = (ctx) => {
  const sets = locked(ctx);
  const { gaps, stray } = report(ctx);
  const forms = sets.probe.question_forms;
  const end = sets.probe.must_end_with;
  const found = stray.map((at) => ({ line: at.line, offending: at.text, fix: "write only `[severity] probe` lines, each optionally followed by a `> snippet` line" }));
  const lastRank = new Map();
  for (const gap of gaps) {
    const rank = sets.severities.indexOf(gap.severity);
    const first = gap.probe.split(/\s+/u)[0].toLowerCase();
    if (rank < 0) found.push({ line: gap.line, offending: gap.text, fix: `use one severity of: ${sets.severities.join(", ")}` });
    if (!forms.includes(first) || !gap.probe.endsWith(end)) found.push({ line: gap.line, offending: gap.text, fix: `open the probe with one of ${forms.join(", ")} and end it with "${end}"` });
    const part = `${gap.category}\u0000${gap.part ?? ""}`;
    if (rank >= 0) {
      if (rank < (lastRank.get(part) ?? -1)) found.push({ line: gap.line, offending: gap.text, fix: `order the gaps ${sets.severities.join(", then ")}` });
      lastRank.set(part, Math.max(rank, lastRank.get(part) ?? -1));
    }
  }
  return found;
};
