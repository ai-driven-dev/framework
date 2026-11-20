"use strict";
// The README animation, the guides' chain diagram and the documents agree with the skills on disk. Anchor: .claude-plugin/marketplace.json.
const fs = require("node:fs");
const path = require("node:path");

const DOCS = ["README.md", "docs/GUIDES.md", "docs/CONCEPTS.md", "docs/INSTALL.md", "docs/FAQ.md"];

module.exports = (ctx) => {
  const root = path.resolve(path.dirname(ctx.abs), "..");
  const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
  const found = [];
  const say = (offending, fix) => found.push({ line: 1, offending, fix });

  const folders = new Set();
  for (const plugin of fs.readdirSync(path.join(root, "plugins"))) {
    const skills = path.join(root, "plugins", plugin, "skills");
    if (fs.existsSync(skills)) for (const skill of fs.readdirSync(skills)) folders.add(`${plugin}:${skill.replace(/^\d+-/u, "")}`);
  }
  const names = new Set([...folders].map((id) => id.split(":")[1]));

  const chain = /```mermaid\nflowchart TD\n {2}subgraph onboard[\s\S]*?```/u.exec(read("docs/GUIDES.md"))?.[0];
  if (!chain) say("docs/GUIDES.md", "docs/GUIDES.md has no end-to-end diagram");
  const drawn = [...(chain ?? "").matchAll(/\/aidd-[a-z]+:\d+-([a-z-]+)/gu)].map((m) => m[1]);
  if (chain && drawn.length <= 5) say("docs/GUIDES.md", "the chain diagram draws no skills");
  for (const name of drawn) if (!names.has(name)) say(name, `the chain diagram draws ${name}, which is not a skill of this repository`);

  const texts = JSON.parse(read("docs/assets/sdlc-demo/scenes.json")).scenes.flatMap((scene) => scene.lines.map((line) => line.text ?? ""));
  const named = new Set(texts.flatMap((text) => text.match(/\/aidd-[a-z]+:[0-9a-z-]+/gu) ?? []));
  if (named.size <= 5) say("scenes.json", "the animation names no skills");
  for (const skill of named) {
    const [, plugin, name] = /^\/(aidd-[a-z]+):(.+)$/u.exec(skill);
    if (!fs.existsSync(path.join(root, "plugins", plugin, "skills", name, "SKILL.md"))) say(skill, `the animation names ${skill}, which is not a skill of this repository`);
  }
  const shown = new Set(texts.flatMap((text) => [...text.matchAll(/\/aidd-[a-z]+:\d+-([0-9a-z-]+)/gu)].map((m) => m[1])));
  shown.delete("sdlc");
  if (chain) for (const name of shown) if (!drawn.includes(name)) say(name, `${name} runs in the animation but is not in the chain diagram`);

  for (const file of DOCS) {
    for (const [, plugin, name] of read(file).matchAll(/\/(aidd-[a-z]+):\d+-([0-9a-z-]+)/gu)) {
      if (!folders.has(`${plugin}:${name}`)) say(`/${plugin}:${name}`, `${file} names /${plugin}:${name}, which is not a skill`);
    }
  }
  return found;
};
