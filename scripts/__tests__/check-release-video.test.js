const assert = require("node:assert/strict");
const test = require("node:test");

const {
  invalidSkips,
  jargonIn,
  missingScenes,
  overlongText,
  run,
  splitThemes,
  surfacesOf,
} = require("../../.claude/skills/release-video/assets/check-release-video.js");

test("surfacesOf names a plugin skill by plugin and skill folder", () => {
  assert.deepEqual(
    surfacesOf([
      "plugins/aidd-dev/skills/10-batch/SKILL.md",
      "plugins/aidd-dev/skills/10-batch/actions/run.md",
      "plugins/aidd-vcs/skills/05-resolve-conflict/SKILL.md",
    ]),
    ["aidd-dev:10-batch", "aidd-vcs:05-resolve-conflict"]
  );
});

test("surfacesOf names a CLI command by its binary subcommand", () => {
  assert.deepEqual(
    surfacesOf(["cli/src/presentation/commands/telemetry.ts"]),
    ["aidd telemetry"]
  );
});

test("surfacesOf ignores files that are not a user-facing surface", () => {
  assert.deepEqual(
    surfacesOf([
      "README.md",
      "plugins/aidd-dev/README.md",
      "plugins/aidd-dev/CATALOG.md",
      "plugins/aidd-dev/.claude-plugin/plugin.json",
      "cli/src/presentation/commands/global-options.ts",
      "cli/src/kernel/paths.ts",
      "scripts/check-release-video.js",
    ]),
    []
  );
});

test("missingScenes lists a surface that no scene shows and no skip explains", () => {
  const plan = {
    scenes: [{ template: "terminal-demo", surfaces: ["aidd telemetry"] }],
    skipped: [{ surface: "aidd-vcs:05-resolve-conflict", reason: "internal" }],
  };

  assert.deepEqual(
    missingScenes(
      ["aidd telemetry", "aidd-dev:10-batch", "aidd-vcs:05-resolve-conflict"],
      plan
    ),
    ["aidd-dev:10-batch"]
  );
});

test("invalidSkips rejects a skip with no reason", () => {
  const plan = {
    scenes: [],
    skipped: [
      { surface: "aidd-dev:10-batch", reason: "  " },
      { surface: "aidd-vcs:05-resolve-conflict", reason: "internal" },
    ],
  };

  assert.deepEqual(invalidSkips(plan), ["aidd-dev:10-batch"]);
});

test("run fails and names every missing scene", () => {
  const errors = [];
  const code = run({
    surfaces: ["aidd-dev:10-batch", "aidd telemetry"],
    plan: { scenes: [], skipped: [] },
    logger: (line) => errors.push(line),
    successLogger: () => {},
  });

  assert.equal(code, 1);
  assert.match(errors.join("\n"), /Scènes manquantes : aidd-dev:10-batch, aidd telemetry/);
});

test("run passes when there is nothing new to show", () => {
  const code = run({
    surfaces: [],
    plan: { scenes: [], skipped: [] },
    logger: () => {},
    successLogger: () => {},
  });

  assert.equal(code, 0);
});

test("run fails on a skip with no reason even when every surface is covered", () => {
  const errors = [];
  const code = run({
    surfaces: ["aidd-dev:10-batch"],
    plan: {
      scenes: [],
      skipped: [{ surface: "aidd-dev:10-batch", reason: "" }],
    },
    logger: (line) => errors.push(line),
    successLogger: () => {},
  });

  assert.equal(code, 1);
  assert.match(errors.join("\n"), /sans raison : aidd-dev:10-batch/);
});

/** A hook runs with GIT_DIR and GIT_INDEX_FILE set: a git command that inherits them acts on the
 * repository being committed, not on the one a test made for itself. */
const withoutGitEnv = () =>
  Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

function makeRepo() {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const { execFileSync } = require("node:child_process");

  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "release-video-"));
  const git = (...args) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
      cwd: repo,
      env: withoutGitEnv(),
      stdio: "pipe",
    });
  const commit = (subject, file) => {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    fs.writeFileSync(path.join(repo, file), subject);
    git("add", ".");
    git("commit", "-q", "-m", subject);
  };

  git("init", "-q");
  commit("feat: before the tag", "plugins/aidd-dev/skills/01-old/SKILL.md");
  git("tag", "v1.0.0");
  commit("feat(aidd-dev): after the tag", "plugins/aidd-dev/skills/10-batch/SKILL.md");
  commit("fix: not a feature", "plugins/aidd-pm/skills/02-user-stories/SKILL.md");
  return { repo, git, commit, remove: () => fs.rmSync(repo, { recursive: true, force: true }) };
}

test("featSurfaces reads only feat commits made since the last release tag", () => {
  const { repo, remove } = makeRepo();
  const found = require("../../.claude/skills/release-video/assets/check-release-video.js").featSurfaces(repo);
  remove();

  assert.deepEqual(found, ["aidd-dev:10-batch"]);
});

test("featSurfaces drops a surface that no longer exists at HEAD", () => {
  const { repo, git, remove } = makeRepo();
  git("rm", "-q", "-r", "plugins/aidd-dev/skills/10-batch");
  git("commit", "-q", "-m", "chore: remove the skill again");
  const found = require("../../.claude/skills/release-video/assets/check-release-video.js").featSurfaces(repo);
  remove();

  assert.deepEqual(found, []);
});

test("featSurfaces reads the repository it is given even when a hook set GIT_DIR", () => {
  const { repo, remove } = makeRepo();
  const decoy = makeRepo();
  decoy.commit("feat: only the decoy has this", "plugins/aidd-vcs/skills/05-decoy/SKILL.md");
  process.env.GIT_DIR = `${decoy.repo}/.git`;
  try {
    assert.deepEqual(require("../../.claude/skills/release-video/assets/check-release-video.js").featSurfaces(repo), ["aidd-dev:10-batch"]);
  } finally {
    delete process.env.GIT_DIR;
    remove();
    decoy.remove();
  }
});

test("a video that shows five of the twelve surfaces a real release shipped is refused", () => {
  const plan = require("./fixtures/release-video-scenes.json");
  const shipped = [
    "aidd telemetry",
    "aidd-context:00-onboard",
    "aidd-context:12-cook",
    "aidd-dev:01-plan",
    "aidd-dev:10-batch",
    "aidd-orchestrator:00-async-dev",
    "aidd-orchestrator:01-sdlc",
    "aidd-orchestrator:02-backlog",
    "aidd-pm:04-spec",
    "aidd-telemetry:00-init",
    "aidd-telemetry:01-usage",
    "aidd-vcs:05-resolve-conflict",
  ];

  assert.deepEqual(missingScenes(shipped, plan), [
    "aidd-context:00-onboard",
    "aidd-context:12-cook",
    "aidd-dev:01-plan",
    "aidd-orchestrator:00-async-dev",
    "aidd-orchestrator:02-backlog",
    "aidd-pm:04-spec",
    "aidd-telemetry:00-init",
  ]);
});

const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

test("overlongText accepts a short intro and a short lead", () => {
  const plan = {
    intro: { tagline: words(6), highlights: [words(5), words(5), words(5)] },
    scenes: [{ lead: words(14) }],
    skipped: [],
  };

  assert.deepEqual(overlongText(plan), []);
});

test("overlongText names the intro tagline that is too long", () => {
  assert.deepEqual(overlongText({ intro: { tagline: words(7) }, scenes: [], skipped: [] }), [
    "intro tagline: 7 words, 6 at most",
  ]);
});

test("overlongText names a highlight that is too long and too many highlights", () => {
  const plan = { intro: { highlights: [words(6), "a", "b", "c"] }, scenes: [], skipped: [] };

  assert.deepEqual(overlongText(plan), ["intro highlights: 4, 3 at most", "intro highlight 1: 6 words, 5 at most"]);
});

test("overlongText names the scene whose lead is too long", () => {
  const plan = { scenes: [{ lead: "short" }, { lead: words(15) }], skipped: [] };

  assert.deepEqual(overlongText(plan), ["scene 2 lead: 15 words, 14 at most"]);
});

test("run fails on a text that is too long even when every surface is covered", () => {
  const errors = [];
  const code = run({
    surfaces: [],
    plan: { intro: { tagline: words(9) }, scenes: [], skipped: [] },
    logger: (line) => errors.push(line),
    successLogger: () => {},
  });

  assert.equal(code, 1);
  assert.match(errors.join("\n"), /Textes trop longs : intro tagline: 9 words, 6 at most/);
});

test("jargonIn names the technical word a viewer would not know, and where it is", () => {
  const plan = {
    intro: { tagline: "Count your tokens", highlights: ["Payloads for Codex"] },
    scenes: [{ title: "A clean", accent: "envelope.", lead: "Read the transcript." }],
    skipped: [],
  };

  assert.deepEqual(jargonIn(plan), [
    'intro tagline: "tokens"',
    'intro highlight 1: "payloads"',
    'scene 1 accent: "envelope"',
    'scene 1 lead: "transcript"',
  ]);
});

test("jargonIn leaves plain words, the word telemetry and the demo window alone", () => {
  const plan = {
    intro: { tagline: "Know what your AI costs.", highlights: ["Telemetry for Claude and Codex"] },
    scenes: [{ title: "See the cost", lead: "One report.", window: { rows: [{ text: "$ aidd telemetry report" }] } }],
    skipped: [],
  };

  assert.deepEqual(jargonIn(plan), []);
});

test("run fails on a technical word in the text a viewer reads", () => {
  const errors = [];
  const code = run({
    surfaces: [],
    plan: { intro: { tagline: "Your tokens" }, scenes: [], skipped: [] },
    logger: (line) => errors.push(line),
    successLogger: () => {},
  });

  assert.equal(code, 1);
  assert.match(errors.join("\n"), /Mots techniques : intro tagline: "tokens"/);
});

test("jargonIn catches every technical word it lists, singular or plural", () => {
  const plan = {
    scenes: [{ title: "axis payloads hooks", accent: "token envelope transcripts" }],
    skipped: [],
  };

  assert.deepEqual(jargonIn(plan), [
    'scene 1 title: "axis"',
    'scene 1 title: "payloads"',
    'scene 1 title: "hooks"',
    'scene 1 accent: "token"',
    'scene 1 accent: "envelope"',
    'scene 1 accent: "transcripts"',
  ]);
});

test("splitThemes names a theme whose scenes are separated by another theme", () => {
  const plan = {
    scenes: [{ pill: "Telemetry" }, { pill: "Rules" }, { pill: "Telemetry" }, { pill: "Rules" }],
    skipped: [],
  };

  assert.deepEqual(splitThemes(plan), ["Telemetry", "Rules"]);
});

test("splitThemes leaves a theme whose scenes follow each other", () => {
  const plan = { scenes: [{ pill: "Telemetry" }, { pill: "Telemetry" }, { pill: "Rules" }], skipped: [] };

  assert.deepEqual(splitThemes(plan), []);
});

test("run fails on a theme split in two parts of the video", () => {
  const errors = [];
  const code = run({
    surfaces: [],
    plan: { scenes: [{ pill: "Telemetry" }, { pill: "Rules" }, { pill: "Telemetry" }], skipped: [] },
    logger: (line) => errors.push(line),
    successLogger: () => {},
  });

  assert.equal(code, 1);
  assert.match(errors.join("\n"), /Thèmes dispersés : Telemetry/);
});

test("overlongText accepts an intro made of tags alone", () => {
  assert.deepEqual(overlongText({ intro: { highlights: ["Telemetry for Codex"] }, scenes: [], skipped: [] }), []);
});

test("run fails when a plan with scenes has no YouTube text to publish", () => {
  const errors = [];
  const code = run({
    surfaces: ["aidd telemetry"],
    plan: { scenes: [{ template: "terminal-demo", surfaces: ["aidd telemetry"] }], skipped: [] },
    logger: (line) => errors.push(line),
    successLogger: () => {},
  });

  assert.equal(code, 1);
  assert.match(errors.join("\n"), /Texte YouTube : youtube: missing/);
});

test("the plan read from disk keeps its YouTube text", () => {
  const { readPlan } = require("../../.claude/skills/release-video/assets/check-release-video.js");

  assert.ok(readPlan().youtube?.themes.length > 0);
});
