"use strict";
// Some action of the skill holding the template links it, as ../assets/<template>.
const fs = require("node:fs");
const path = require("node:path");

module.exports = (ctx) => {
  const actions = path.resolve(path.dirname(ctx.abs), "..", "actions");
  const name = path.basename(ctx.abs);
  const link = `](../assets/${name})`;
  const cited = fs.existsSync(actions) && fs.readdirSync(actions).some((f) => f.endsWith(".md") && fs.readFileSync(path.join(actions, f), "utf8").includes(link));
  return cited ? [] : [{ line: 1, offending: name, fix: "no action of the skill links {template}", values: { template: name } }];
};
