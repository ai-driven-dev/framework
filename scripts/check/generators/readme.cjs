"use strict";
// README.md, from the plugin tree and docs/assets/plugins/plugins.json: the hero counts, the plugin grid and each plugin's skill count.
// The tool list, from the CLI's tool-support record, stays with scripts/sync-generated-docs.mjs.
const fs = require("node:fs");
const path = require("node:path");

const STATUS = {
  stable: { label: "stable", color: "2da44e" },
  beta: { label: "beta", color: "bf8700" },
  alpha: { label: "alpha", color: "cf222e" },
  preview: { label: "preview", color: "0969da" },
};

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

module.exports = {
  name: "readme",
  watch: ["README.md", "plugins/**", "docs/assets/plugins/plugins.json"],
  run({ root, write }) {
    const readme = path.join(root, "README.md");
    if (!fs.existsSync(readme)) return [];
    const base = path.join(root, "plugins");
    const dirs = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);
    // A directory under skills/ is a skill once it carries a SKILL.md, the CLI's own test.
    const skillsOf = (plugin) => dirs(path.join(base, plugin, "skills")).filter((s) => fs.existsSync(path.join(base, plugin, "skills", s, "SKILL.md"))).sort().map((s) => s.replace(/^\d+-/u, ""));
    const agentsOf = (plugin) => {
      const dir = path.join(base, plugin, "agents");
      return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(".md")).length : 0;
    };
    const hooksOf = (plugin) => {
      const manifest = path.join(base, plugin, "hooks", "hooks.json");
      return fs.existsSync(manifest) ? Object.keys(JSON.parse(fs.readFileSync(manifest, "utf8")).hooks ?? {}).length : 0;
    };
    const plugins = dirs(base).sort();
    const before = fs.readFileSync(readme, "utf8");
    let text = before;

    const hero = `<kbd>${plugins.length} plugins</kbd> · <kbd>${plugins.reduce((n, p) => n + skillsOf(p).length, 0)} skills</kbd> · <kbd>${plugins.reduce((n, p) => n + agentsOf(p), 0)} agents</kbd>`;
    text = text.replace(/<!--counts:start-->[\s\S]*?<!--counts:end-->/u, () => `<!--counts:start-->${hero}<!--counts:end-->`);
    for (const name of plugins) {
      const n = skillsOf(name).length;
      // The first `N skill(s)` code-span within 140 characters of the plugin's heading link.
      const pattern = new RegExp(`(\\[${escaped(name)}\\]\\(plugins/${escaped(name)}/README\\.md\\)[\\s\\S]{0,140}?\`)\\d+\\s+skills?(\`)`, "u");
      text = text.replace(pattern, (_, open, close) => `${open}${plural(n, "skill")}${close}`);
    }

    const config = JSON.parse(fs.readFileSync(path.join(root, "docs", "assets", "plugins", "plugins.json"), "utf8"));
    const missing = plugins.filter((p) => !(p in config));
    const unknown = Object.keys(config).filter((p) => !plugins.includes(p));
    if (missing.length > 0 || unknown.length > 0) throw new Error(`plugins.json and plugins/ disagree. No entry: ${missing}. No plugin: ${unknown}`);
    const cell = (plugin) => {
      const entry = config[plugin];
      const status = STATUS[entry.status];
      const hooks = hooksOf(plugin);
      const agents = agentsOf(plugin);
      const counts = [plural(skillsOf(plugin).length, "skill"), agents > 0 && plural(agents, "agent"), hooks > 0 && plural(hooks, "hook")].filter(Boolean).join(" · ");
      return [
        '<td width="33%" valign="top">',
        `<a href="plugins/${plugin}/README.md">`,
        `<img align="right" alt="${status.label}" src="https://img.shields.io/badge/${status.label}-${status.color}?style=flat-square" />`,
        `<h3>${entry.emoji} ${plugin}</h3>`,
        `${counts}<br />`,
        `${entry.description}`,
        "</a>",
        "</td>",
      ].join("\n");
    };
    const order = Object.keys(config);
    const rows = [];
    for (let at = 0; at < order.length; at += 3) {
      const row = order.slice(at, at + 3).map(cell);
      while (row.length < 3) row.push('<td width="33%"></td>');
      rows.push(`<tr>\n${row.join("\n")}\n</tr>`);
    }
    const grid = /(<!--plugins:start-->)[\s\S]*?(<!--plugins:end-->)/u;
    if (!grid.test(text)) throw new Error("markers <!--plugins:start--> and <!--plugins:end--> not found");
    text = text.replace(grid, (_, open, close) => `${open}\n\n<table>\n${rows.join("\n")}\n</table>\n\n${close}`);

    if (text === before) return [];
    if (write) fs.writeFileSync(readme, text);
    return ["README.md"];
  },
};
