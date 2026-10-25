const assert = require("node:assert/strict");
const test = require("node:test");

const { youtubeMetadata, youtubeProblems } = require("../../.claude/skills/release-video/assets/youtube-metadata.js");

const plan = {
  scenes: [
    { template: "terminal-demo", surfaces: ["aidd telemetry"] },
    { template: "terminal-demo", surfaces: ["aidd-context:05-rule-generate"] },
    { template: "contributors", logins: ["alexsoyes", "blafourcade"] },
  ],
  skipped: [],
  youtube: {
    themes: ["Télémétrie", "Codex", "Règles"],
    programme: [
      { surface: "aidd telemetry", text: "compter aussi le travail fait avec Codex." },
      { surface: "aidd-context:05-rule-generate", text: "vérifier qu'aucune règle n'en contredit une autre." },
    ],
  },
};
const context = { version: "5.13", tag: "v5.13.0", repo: "ai-driven-dev/framework" };

test("the title names the release and its themes the way the published ones do", () => {
  assert.equal(youtubeMetadata(plan, context).title, "Framework - Release 5.13 : Télémétrie, Codex et Règles");
  assert.equal(
    youtubeMetadata({ ...plan, youtube: { ...plan.youtube, themes: ["Télémétrie", "Règles"] } }, context).title,
    "Framework - Release 5.13 : Télémétrie et Règles",
  );
  assert.equal(
    youtubeMetadata({ ...plan, youtube: { ...plan.youtube, themes: ["Télémétrie"] } }, context).title,
    "Framework - Release 5.13 : Télémétrie",
  );
});

test("the description follows the published layout, with commands, contributors and links", () => {
  assert.equal(
    youtubeMetadata(plan, context).description,
    [
      "Les nouveautés du framework AI-Driven Dev 5.13, démontrées de bout en bout.",
      "",
      "Au programme :",
      "- aidd telemetry : compter aussi le travail fait avec Codex.",
      "- /aidd-context:05-rule-generate : vérifier qu'aucune règle n'en contredit une autre.",
      "",
      "Version livrée par 2 contributeurs (crédits dans les notes de version).",
      "",
      "Notes de version : https://github.com/ai-driven-dev/framework/releases/tag/v5.13.0",
      "Code source : https://github.com/ai-driven-dev/framework",
    ].join("\n"),
  );
});

test("a plugin skill is written as a slash command and a CLI command is left as it is", () => {
  const { description } = youtubeMetadata(plan, context);

  assert.match(description, /^- aidd telemetry : /m);
  assert.match(description, /^- \/aidd-context:05-rule-generate : /m);
});

test("a release with no contributors scene leaves the contributors line out", () => {
  const { description } = youtubeMetadata({ ...plan, scenes: plan.scenes.slice(0, 2) }, context);

  assert.doesNotMatch(description, /contributeurs/);
});

test("youtubeProblems accepts a plan whose programme covers every scene surface", () => {
  assert.deepEqual(youtubeProblems(plan), []);
});

test("youtubeProblems names a missing block, a title that is too long and an uncovered surface", () => {
  assert.deepEqual(youtubeProblems({ scenes: [], skipped: [] }), ["youtube: missing"]);

  const long = { ...plan, youtube: { ...plan.youtube, themes: ["x".repeat(90)] } };
  assert.match(youtubeProblems(long).join("\n"), /title: \d+ characters, 100 at most/);

  const uncovered = { ...plan, youtube: { ...plan.youtube, programme: plan.youtube.programme.slice(0, 1) } };
  assert.deepEqual(youtubeProblems(uncovered), ["youtube programme: no line for aidd-context:05-rule-generate"]);
});
