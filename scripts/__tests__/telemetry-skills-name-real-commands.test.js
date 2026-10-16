const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const SKILLS = path.join(ROOT, "plugins", "aidd-telemetry", "skills");
const SURFACE = path.join(ROOT, "cli", "tests", "golden", "snapshots", "help", "surface.json");

/**
 * The telemetry skills are thin over `aidd telemetry`: every command they tell a model to run
 * is checked here against the help the CLI really prints (the help golden), so a command
 * renamed in the CLI turns the skill red instead of silently sending a person to a command
 * that does not exist. Only code spans and fenced blocks are read: prose may name the group.
 */

const FLAG = /(?<![\w-])--[a-z][a-z-]*/gu;
const COMMAND = /aidd telemetry\b([^;&|\n]*)/gu;

function surface() {
  return JSON.parse(fs.readFileSync(SURFACE, "utf8"));
}

/** `{ commands: Map<name, { flags: Set, choices: Map<flag, Set> }> }` from the golden help. */
function telemetryHelp() {
  const entries = surface().filter((entry) => entry.invocation.startsWith("aidd telemetry"));
  const group = entries.find((entry) => entry.invocation.trim() === "aidd telemetry");
  assert.ok(group, "the help golden has no `aidd telemetry` entry");
  const commands = new Map();
  for (const entry of entries) {
    const name = entry.invocation.trim().split(/\s+/u)[2];
    if (name === undefined) continue;
    const help = entry.help.replace(/\s+/gu, " ");
    const choices = new Map();
    for (const match of help.matchAll(/(--[a-z-]+)(?:(?!--)[^(])*\(choices: ([^)]*)\)/gu)) {
      choices.set(match[1], new Set([...match[2].matchAll(/"([^"]+)"/gu)].map((m) => m[1])));
    }
    commands.set(name, { flags: new Set(help.match(FLAG) ?? []), choices });
  }
  return commands;
}

function markdownUnder(directory, found = []) {
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) markdownUnder(full, found);
    else if (entry.name.endsWith(".md")) found.push(full);
  }
  return found;
}

/** The text of every fenced block and inline code span. */
function codeRegions(markdown) {
  const regions = [];
  const withoutFences = markdown.replace(/^(```|~~~)[^\n]*\n([\s\S]*?)^\1[ \t]*$/gmu, (_, __, body) => {
    regions.push(body);
    return "";
  });
  for (const match of withoutFences.matchAll(/`([^`\n]+)`/gu)) regions.push(match[1]);
  return regions;
}

/** Every `aidd telemetry ...` a skill's code names, as `{ file, text, sub, rest }`. */
function mentions() {
  const found = [];
  for (const file of markdownUnder(SKILLS)) {
    const relative = path.relative(ROOT, file).split(path.sep).join("/");
    for (const region of codeRegions(fs.readFileSync(file, "utf8"))) {
      for (const match of region.matchAll(COMMAND)) {
        const words = match[1].trim().split(/\s+/u).filter(Boolean);
        found.push({ file: relative, text: `aidd telemetry${match[1]}`.trim(), sub: words[0], rest: words.slice(1) });
      }
    }
  }
  return found;
}

function skillFolders() {
  if (!fs.existsSync(SKILLS)) return [];
  return fs.readdirSync(SKILLS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
}

describe("the telemetry skills name only commands the CLI has", () => {
  const help = telemetryHelp();

  it("ships the two skills, and each names at least one command", () => {
    assert.deepEqual(skillFolders().sort(), ["00-init", "01-usage"]);
    const named = new Set(mentions().map((mention) => mention.file.split("/")[3]));
    assert.deepEqual([...named].sort(), ["00-init", "01-usage"]);
  });

  it("names a subcommand that exists in the help golden", () => {
    const unknown = mentions()
      .filter((mention) => mention.sub !== undefined && !mention.sub.startsWith("-"))
      .filter((mention) => !help.has(mention.sub))
      .map((mention) => `${mention.file}: \`${mention.text}\``);
    assert.deepEqual(unknown, [], "a skill names a telemetry command the CLI does not have");
  });

  it("passes only flags that command accepts, and only values its choices allow", () => {
    const wrong = [];
    for (const mention of mentions()) {
      const command = help.get(mention.sub);
      if (command === undefined) continue;
      mention.rest.forEach((word, at) => {
        if (word.startsWith("--") && !command.flags.has(word)) {
          wrong.push(`${mention.file}: \`${mention.text}\` has no ${word}`);
        }
        const allowed = command.choices.get(mention.rest[at - 1]);
        if (allowed !== undefined && /^[a-z]+$/u.test(word) && !allowed.has(word)) {
          wrong.push(`${mention.file}: \`${mention.text}\` gives ${mention.rest[at - 1]} the value ${word}`);
        }
      });
    }
    assert.deepEqual(wrong, []);
  });

  it("gives --axis only values report accepts, in every code span", () => {
    const allowed = help.get("report").choices.get("--axis");
    const wrong = [];
    for (const file of markdownUnder(SKILLS)) {
      for (const region of codeRegions(fs.readFileSync(file, "utf8"))) {
        for (const [, value] of region.matchAll(/--axis\s+([a-z]+)/gu)) {
          if (!allowed.has(value)) wrong.push(`${path.relative(ROOT, file)}: --axis ${value}`);
        }
      }
    }
    assert.deepEqual(wrong, []);
  });

  it("uses no flag in a code span that no telemetry command has", () => {
    const known = new Set(["--help", "--version", ...[...help.values()].flatMap((c) => [...c.flags])]);
    const wrong = [];
    for (const file of markdownUnder(SKILLS)) {
      for (const region of codeRegions(fs.readFileSync(file, "utf8"))) {
        for (const flag of region.match(FLAG) ?? []) {
          if (!known.has(flag)) wrong.push(`${path.relative(ROOT, file)}: ${flag}`);
        }
      }
    }
    assert.deepEqual(wrong, []);
  });
  it("names no hook internals and nothing of the measurement it replaced", () => {
    const internal = /\bhooks?\b|prompt-gate|session-start|catch-up|\bV1\b|previous (?:version|measurement|telemetry)|journal|trailer|backlog-link|aidd_docs\/runs/iu;
    const found = markdownUnder(SKILLS)
      .map((file) => [path.relative(ROOT, file), internal.exec(fs.readFileSync(file, "utf8"))])
      .filter(([, hit]) => hit !== null)
      .map(([file, hit]) => `${file}: ${hit[0]}`);
    assert.deepEqual(found, []);
  });
});
