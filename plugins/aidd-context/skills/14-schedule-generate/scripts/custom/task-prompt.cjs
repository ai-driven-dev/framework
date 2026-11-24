"use strict";
const path = require("node:path");
const { headings, proseLines, readText } = require("../lib/markdown.cjs");

const template = readText(path.join(__dirname, "../../assets/task-prompt.md"));
const sections = headings(proseLines(template)).filter((heading) => heading.level === 2);
const slots = new Set(template.match(/\{\{[^}\n]+\}\}/gu));
const note = template.trimEnd().split("\n").at(-1);

module.exports = (ctx) => {
  const found = [];
  const outline = headings(ctx.prose);
  const titles = outline.filter((heading) => heading.level === 1);
  if (titles.length !== 1 || outline[0] !== titles[0]) found.push({ line: 1, fix: "start with one task title" });

  // Translated headings retain their positions and may use any language.
  const actual = outline.filter((heading) => heading.level === 2);
  if (actual.length !== sections.length || new Set(actual.map((heading) => heading.name)).size !== sections.length) {
    found.push({ line: 1, fix: `use the ${sections.length} distinct sections of task-prompt.md in order` });
  }
  for (const [index, heading] of actual.entries()) {
    const known = sections.findIndex((section) => section.name === heading.name);
    if (known >= 0 && known !== index) found.push({ line: heading.line, fix: `put ${heading.name} in template order` });
    const end = (actual[index + 1]?.line ?? ctx.lines.length + 1) - 1;
    if (!ctx.lines.slice(heading.line, end).some((line) => line.trim())) found.push({ line: heading.line, fix: "fill this section" });
    const prose = ctx.prose.slice(heading.line, end);
    if (sections[index]?.name === "Process" && !prose.some((line) => /^ {0,3}\d+[.)]\s+\S/u.test(line))) {
      found.push({ line: heading.line, fix: "write the workflow as numbered steps in the process section" });
    }
  }
  for (const [index, line] of ctx.lines.entries()) {
    if (line.trim() === note || [...line.matchAll(/\{\{[^}\n]+\}\}/gu)].some(([value]) => slots.has(value))) {
      found.push({ line: index + 1, fix: "replace the template slot or remove its authoring note" });
    }
  }
  return found;
};
