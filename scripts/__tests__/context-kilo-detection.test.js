const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// These checks read the Markdown contracts that ship to the model. The small
// interpreter below is a test oracle for explicit path alternatives, not a
// production detector or proof that a model follows the contract at runtime.
const ROOT = path.resolve(__dirname, "../..");
const FIXTURES = path.join(__dirname, "fixtures/context-generation/detection");
const CONTRACTS = [
  "plugins/aidd-context/skills/00-onboard/references/state/detection.md",
  "plugins/aidd-context/skills/02-project-memory/references/tools.md",
];
const GENERATORS = [
  {
    path: "plugins/aidd-context/skills/05-rule-generate",
    reference: "rule-publication.md",
    kind: "rule",
  },
  {
    path: "plugins/aidd-context/skills/08-hook-generate",
    reference: "tool-paths.md",
    kind: "hook",
  },
];
const SIGNALS = [
  ".kilo/",
  "kilo.json",
  "kilo.jsonc",
  ".kilo/kilo.json",
  ".kilo/kilo.jsonc",
  ".kilocode/",
];

// Retain the legitimate source reference for the historical fallback signal:
// https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/kilocode/skills/kilo-config.md

function row(text, tool) {
  const line = text.split("\n").find((candidate) =>
    new RegExp(`^\\|\\s*${tool}\\s*\\|`, "u").test(candidate)
  );
  assert.ok(line, `Missing ${tool} detection row`);
  const [, , detection, destination] = line.split("|");
  return {
    signals: [...detection.matchAll(/`([^`]+)`/gu)].map((match) => match[1]),
    destination: destination.trim().replaceAll("`", ""),
  };
}

function hasSignal(project, signal) {
  const target = path.join(project, signal);
  if (!fs.existsSync(target)) return false;
  return signal.endsWith("/") ? fs.statSync(target).isDirectory() : fs.statSync(target).isFile();
}

const scenarios = JSON.parse(fs.readFileSync(path.join(FIXTURES, "cases.json"), "utf8"));

for (const contract of CONTRACTS) {
  const text = fs.readFileSync(path.join(ROOT, contract), "utf8");

  test(`${contract}: six distinct Kilo signals, one shared memory destination`, () => {
    const kilo = row(text, "kilo");
    assert.deepEqual([...kilo.signals].sort(), [...SIGNALS].sort());
    assert.equal(kilo.destination, "AGENTS.md");
    for (const tool of ["codex", "cursor", "opencode"]) {
      assert.equal(row(text, tool).destination, kilo.destination);
    }
    assert.deepEqual(row(text, "opencode").signals, [".opencode/"]);
  });

  for (const scenario of scenarios) {
    test(`${contract}: ${scenario.name}`, () => {
      const project = path.join(FIXTURES, scenario.project);
      const kilo = row(text, "kilo");
      // A nested configuration also necessarily creates .kilo/. The separate
      // exact signal assertion above catches omission of either nested format.
      assert.equal(kilo.signals.some((signal) => hasSignal(project, signal)), scenario.kilo);
      if (scenario.signals) {
        for (const signal of scenario.signals) assert.ok(hasSignal(project, signal), signal);
      }
      if (scenario.tools) {
        for (const tool of scenario.tools) {
          assert.ok(row(text, tool).signals.some((signal) => hasSignal(project, signal)), tool);
        }
        assert.equal(new Set(scenario.tools.map((tool) => row(text, tool).destination)).size, 1);
      }
    });
  }

  test(`${contract}: legacy is detection only and OpenCode config is not a Kilo signal`, () => {
    assert.match(text, /\.kilocode\/[^\n]*(?:legacy|historical)[^\n]*detection/iu);
    if (contract.includes('02-project-memory')) {
      assert.match(text, /\.kilocode\/[^\n]*detection signal only; selected Kilo memory goes to the shared root `AGENTS\.md`/iu);
      assert.match(text, /Neither `opencode\.json` nor `opencode\.jsonc` identifies Kilo/u);
    } else {
      assert.match(text, /Treat `\.kilocode\/` as a legacy Kilo detection signal, never an output path/u);
      assert.match(text, /OpenCode JSON config files do not identify Kilo/u);
    }
  });
}

for (const generator of GENERATORS) {
  const action = path.join(ROOT, generator.path, `actions/01-capture-${generator.kind}.md`);
  const reference = path.join(ROOT, generator.path, "references", generator.reference);

  test(`${generator.path}: capture action loads its own publication reference`, () => {
    const actionText = fs.readFileSync(action, "utf8");
    const links = [...actionText.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)];
    assert.ok(links.length > 0, "capture action must link its publication reference");
    assert.ok(links.some(([, relative]) => path.resolve(path.dirname(action), relative) === reference));
    const text = fs.readFileSync(reference, "utf8");
    if (generator.kind === "hook") {
      assert.match(text, /## Host detection\n\n([^\n]+)\n/u);
      assert.doesNotMatch(text.match(/## Host detection\n\n([^\n]+)\n/u)[1], /\]\([^)]*\.\.\/[^)]*\)/u);
    } else {
      assert.match(text, /## Publications\n/u);
      assert.match(text, /## Kilo configuration\n/u);
    }
  });

  const text = fs.readFileSync(reference, "utf8");
  const hookGuidance = generator.kind === "hook"
    ? text.match(/## Host detection\n\n([^\n]+)\n/u)?.[1]
    : undefined;
  const kiloSection = generator.kind === "rule"
    ? text.match(/## Kilo configuration\n([\s\S]*?)(?=\n## |$)/u)?.[1]
    : undefined;
  const detectionContract = generator.kind === "hook" ? hookGuidance : kiloSection;

  test(`${generator.path}: local guidance covers Kilo signals and exclusions`, () => {
    assert.ok(detectionContract, "missing local Kilo detection guidance");
    for (const signal of SIGNALS) assert.ok(detectionContract.includes(`\`${signal}\``), signal);

    if (generator.kind === "hook") {
      assert.match(hookGuidance, /`AGENTS\.md`, `opencode\.json`, or `opencode\.jsonc` alone do not identify Kilo/u);
      assert.match(hookGuidance, /legacy `\.kilocode\/`.*detection signal only/u);
      assert.match(hookGuidance, /new Kilo [^.]*under `\.kilo\/`/u);
      return;
    }

    assert.match(kiloSection, /Root `AGENTS\.md` and OpenCode configuration alone do not identify Kilo/u);
    assert.match(kiloSection, /legacy directory is a detection signal only; write new rules under `\.kilo\/`/u);
  });

  for (const scenario of scenarios) {
    test(`${generator.path}: ${scenario.name}`, () => {
      const project = path.join(FIXTURES, scenario.project);
      const detected = SIGNALS.some((signal) => detectionContract.includes(`\`${signal}\``) && hasSignal(project, signal));
      assert.equal(detected, scenario.kilo);
    });
  }

  if (generator.kind === "rule") {
    test(`${generator.path}: publication target and Kilo configuration choices remain explicit`, () => {
      assert.ok(text.includes("| Kilo / `kilo` | `.kilo/rules/<category>/<slug>.md` plus an exact `instructions` entry in the selected `kilo.json[c]` |"));
      for (const config of [".kilo/kilo.json", ".kilo/kilo.jsonc", "kilo.json", "kilo.jsonc"]) {
        assert.ok(kiloSection.includes(`\`${config}\``), config);
      }
      assert.match(kiloSection, /`\.kilo\/` takes precedence over root; do not assume an ordering between JSON and JSONC at the same level/u);
      assert.match(kiloSection, /With no config, the writer creates `\.kilo\/kilo\.jsonc`/u);
      assert.match(kiloSection, /With one config, it uses that file/u);
      assert.match(kiloSection, /With several, it reuses the unique owner of the exact rule path; otherwise present the candidates and require the user to select one with `--kilo-config`/u);
      assert.match(kiloSection, /Invalid or unsafe candidates refuse publication before writing/u);
      assert.match(kiloSection, /preserves JSONC comments, entry order, duplicates and unrelated values/u);
      assert.match(kiloSection, /restores completed replacements after covered errors/u);
    });
  }
}
