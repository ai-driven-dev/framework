"use strict";
// A declared skills[] equals the skill folders on disk (absent: the host reads ./skills itself), a declared agents[] names files that exist, and the marketplace entry carries the same description.
const fs = require("node:fs");
const path = require("node:path");

module.exports = (ctx) => {
  let manifest;
  try {
    manifest = JSON.parse(ctx.text);
  } catch {
    return [];
  }
  const plugin = path.resolve(path.dirname(ctx.abs), "..");
  const dir = path.join(plugin, "skills");
  const onDisk = fs.existsSync(dir) ? fs.readdirSync(dir).filter((s) => fs.existsSync(path.join(dir, s, "SKILL.md"))).map((s) => `./skills/${s}`) : [];
  const listed = manifest.skills ?? onDisk;
  const lineOf = (key) => ctx.lines.findIndex((l) => l.includes(`"${key}"`)) + 1 || 1;
  const found = [];
  for (const s of onDisk) if (!listed.includes(s)) found.push({ line: lineOf("skills"), offending: s, fix: `${s} is not listed in skills` });
  for (const s of listed) if (!onDisk.includes(s)) found.push({ line: lineOf("skills"), offending: s, fix: `${s} is listed but has no SKILL.md` });
  for (const a of manifest.agents ?? []) if (!fs.existsSync(path.join(plugin, a))) found.push({ line: lineOf("agents"), offending: a, fix: `${a} is listed in agents but does not exist` });
  const market = path.resolve(plugin, "../../.claude-plugin/marketplace.json");
  if (fs.existsSync(market)) {
    const entry = JSON.parse(fs.readFileSync(market, "utf8")).plugins?.find((p) => p.name === manifest.name);
    if (!entry) found.push({ line: lineOf("name"), offending: manifest.name, fix: "not in marketplace.json" });
    else if (entry.description !== manifest.description) found.push({ line: lineOf("description"), offending: manifest.description, fix: "description differs from marketplace.json" });
  }
  return found;
};
