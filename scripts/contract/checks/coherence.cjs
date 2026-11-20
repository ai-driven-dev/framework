"use strict";
// skills[] equals the skill folders on disk, and the marketplace entry carries the same description.
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
  const listed = manifest.skills ?? [];
  const lineOf = (key) => ctx.lines.findIndex((l) => l.includes(`"${key}"`)) + 1 || 1;
  const found = [];
  for (const s of onDisk) if (!listed.includes(s)) found.push({ line: lineOf("skills"), offending: s, values: { problem: `${s} is not listed in skills` } });
  for (const s of listed) if (!onDisk.includes(s)) found.push({ line: lineOf("skills"), offending: s, values: { problem: `${s} is listed but has no SKILL.md` } });
  const market = path.resolve(plugin, "../../.claude-plugin/marketplace.json");
  if (fs.existsSync(market)) {
    const entry = JSON.parse(fs.readFileSync(market, "utf8")).plugins?.find((p) => p.name === manifest.name);
    if (!entry) found.push({ line: lineOf("name"), offending: manifest.name, values: { problem: "not in marketplace.json" } });
    else if (entry.description !== manifest.description) found.push({ line: lineOf("description"), offending: manifest.description, values: { problem: "description differs from marketplace.json" } });
  }
  return found;
};
