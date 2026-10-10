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
