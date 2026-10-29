const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");
const { REPO_ROOT: ROOT } = require("../lib/repository-path.cjs");

/**
 * The README animation is drawn from `docs/assets/sdlc-demo/scenes.json`. It names the steps of
 * the flow and the skills that run them, so it must agree with the README's chain diagram
 * (its Mermaid chain) and name only skills that exist.
 */

const scenes = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/assets/sdlc-demo/scenes.json"), "utf8"));
const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

function skillFolders() {
  const folders = new Set();
  for (const plugin of fs.readdirSync(path.join(ROOT, "plugins"))) {
    const skills = path.join(ROOT, "plugins", plugin, "skills");
    if (!fs.existsSync(skills)) continue;
    for (const skill of fs.readdirSync(skills)) folders.add(`${plugin}:${skill.replace(/^\d+-/, "")}`);
  }
  return folders;
}

/** The skill names the README chain draws, in the order it draws them. */
function drawnSkills() {
  const chain = readme.match(/```mermaid\nflowchart TD\n  subgraph legend[\s\S]*?```/)?.[0];
  assert.ok(chain, "the README has no chain diagram");
  return [...chain.matchAll(/\/aidd-[a-z]+:\d+-([a-z-]+)/g)].map((m) => m[1]);
}

describe("the README animation", () => {
  it("names only skills that exist", () => {
    const named = new Set(
      scenes.scenes.flatMap((scene) => scene.lines.flatMap((line) => line.text?.match(/\/aidd-[a-z]+:[0-9a-z-]+/g) ?? [])),
    );
    assert.ok(named.size > 5, "the animation names no skills");
    for (const skill of named) {
      const [, plugin, name] = skill.match(/^\/(aidd-[a-z]+):(.+)$/);
      assert.ok(
        fs.existsSync(path.join(ROOT, "plugins", plugin, "skills", name, "SKILL.md")),
        `${skill} is not a skill of this repository`,
      );
    }
  });

  it("runs the skills the chain diagram draws", () => {
    const drawn = new Set(drawnSkills());
    const shown = new Set(
      scenes.scenes.flatMap((scene) =>
        scene.lines.flatMap((line) => [...(line.text?.matchAll(/\/aidd-[a-z]+:\d+-([0-9a-z-]+)/g) ?? [])].map((m) => m[1])),
      ),
    );
    shown.delete("sdlc");
    for (const skill of shown) assert.ok(drawn.has(skill), `${skill} runs in the animation but is not in the chain diagram`);
  });
});

describe("the chain diagram", () => {
  it("draws only skills that exist", () => {
    const names = new Set([...skillFolders()].map((id) => id.split(":")[1]));
    const drawn = drawnSkills();
    assert.ok(drawn.length > 5, "the diagram draws no skills");
    for (const name of drawn) assert.ok(names.has(name), `${name} is not a skill of this repository`);
  });
});

describe("the documents that name skills", () => {
  it("name only skills that exist", () => {
    const known = skillFolders();
    for (const file of ["README.md", "docs/GUIDES.md", "docs/CONCEPTS.md", "docs/INSTALL.md", "docs/FAQ.md"]) {
      const text = fs.readFileSync(path.join(ROOT, file), "utf8");
      for (const [, plugin, name] of text.matchAll(/\/(aidd-[a-z]+):\d+-([0-9a-z-]+)/g)) {
        assert.ok(known.has(`${plugin}:${name}`), `${file} names /${plugin}:${name}, which is not a skill`);
      }
    }
  });
});
