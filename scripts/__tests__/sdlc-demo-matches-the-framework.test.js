const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");
const { REPO_ROOT: ROOT } = require("../lib/repository-path.cjs");

/**
 * The README animation is drawn from `docs/assets/sdlc-demo/scenes.json`. It names the steps of
 * the flow and the skills that run them, so it must agree with the README's chain diagram
 * (`docs/assets/diagrams/sdlc.json`) and name only skills that exist.
 */

const scenes = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/assets/sdlc-demo/scenes.json"), "utf8"));
const chain = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/assets/diagrams/sdlc.json"), "utf8"));

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
    const drawn = new Set(chain.zones.flatMap((zone) => zone.steps.map((step) => step.skill).filter(Boolean)));
    const shown = new Set(
      scenes.scenes.flatMap((scene) => scene.lines.flatMap((line) => line.text?.match(/aidd-[a-z]+:[0-9a-z-]+/g) ?? [])),
    );
    shown.delete("aidd-orchestrator:01-sdlc");
    for (const skill of shown) assert.ok(drawn.has(skill), `${skill} runs in the animation but is not in the chain diagram`);
  });
});

describe("the chain diagram", () => {
  it("names only skills that exist", () => {
    const skills = chain.zones.flatMap((zone) => zone.steps.map((step) => step.skill).filter(Boolean));
    assert.ok(skills.length > 5, "the diagram names no skills");
    for (const skill of skills) {
      const [plugin, name] = skill.split(":");
      assert.ok(
        fs.existsSync(path.join(ROOT, "plugins", plugin, "skills", name, "SKILL.md")),
        `${skill} is not a skill of this repository`,
      );
    }
  });

  it("labels each step with its skill's name", () => {
    for (const step of chain.zones.flatMap((zone) => zone.steps)) {
      if (step.skill) assert.equal(step.skill.split(":")[1].replace(/^\d+-/, ""), step.label);
    }
  });
});
