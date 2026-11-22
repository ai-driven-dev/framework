"use strict";
// A skill never names a skill of a sibling plugin as `aidd-<plugin>:<skill>`; it names the concept the plugin owns.
const path = require("node:path");

const ADDRESS = /(?<![\w/@-])(?:[@/])?(aidd-[a-z0-9]+(?:-[a-z0-9]+)*):([A-Za-z0-9][\w.-]*)/gu;
const ORCHESTRATOR = "aidd-orchestrator";
// Expires with #883, which makes 00-onboard resolve its providers at runtime.
const ONBOARD = "plugins/aidd-context/skills/00-onboard";

module.exports = (ctx) => {
  const skills = path.dirname(ctx.root);
  if (path.basename(skills) !== "skills") return [];
  const pluginDir = path.dirname(skills);
  if (path.basename(path.dirname(pluginDir)) !== "plugins") return [];
  const plugin = path.basename(pluginDir);
  if (plugin === ORCHESTRATOR || `plugins/${plugin}/skills/${path.basename(ctx.root)}` === ONBOARD) return [];
  const found = [];
  ctx.lines.forEach((line, index) => {
    for (const match of line.matchAll(ADDRESS)) if (match[1] !== plugin) found.push({ line: index + 1, offending: match[0], values: { plugin: match[1] }, fix: "name the concept {plugin} owns, not its skill" });
  });
  return found;
};
