#!/usr/bin/env node
/**
 * Fails when a feature shipped since the last release has no scene in the release video, and
 * no written reason for being left out. A release with no `feat:` commit needs no video.
 *
 * A surface is something a user can run: a plugin skill (`aidd-dev:10-batch`) or a CLI command
 * (`aidd telemetry`). It is read from the files a `feat:` commit adds or modifies, so a
 * rename shows the new name only.
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { youtubeProblems } = require("./youtube-metadata.js");

const ROOT = path.resolve(__dirname, "../../../..");
const PLAN_PATH = path.join(ROOT, "aidd_docs/release-video/scenes.json");

/** Files in the commands folder that are plumbing, not a command a user types. */
const NOT_COMMANDS = new Set([
  "global-options",
  "menu",
  "spawn-cli-command",
  "sync-native-activation",
]);

const SKILL = /^plugins\/([^/]+)\/skills\/(\d{2}-[^/]+)\//;
const COMMAND = /^cli\/src\/presentation\/commands\/([^/]+)\.ts$/;

function surfaceOf(file) {
  const skill = SKILL.exec(file);
  if (skill) return `${skill[1]}:${skill[2]}`;
  const command = COMMAND.exec(file);
  if (command && !NOT_COMMANDS.has(command[1])) return `aidd ${command[1]}`;
  return null;
}

function surfacesOf(files) {
  const found = new Set(files.map(surfaceOf).filter(Boolean));
  return [...found].sort();
}

/** Where a surface lives, so a surface added then removed or renamed in the same cycle is dropped. */
function pathOf(surface) {
  if (surface.startsWith("aidd ")) {
    return `cli/src/presentation/commands/${surface.slice(5)}.ts`;
  }
  const [plugin, skill] = surface.split(":");
  return `plugins/${plugin}/skills/${skill}`;
}

function shown(plan) {
  return new Set(plan.scenes.flatMap((scene) => scene.surfaces ?? []));
}

function missingScenes(surfaces, plan) {
  const covered = shown(plan);
  const skipped = new Set(plan.skipped.map((skip) => skip.surface));
  return surfaces.filter((s) => !covered.has(s) && !skipped.has(s));
}

function invalidSkips(plan) {
  return plan.skipped
    .filter((skip) => !String(skip.reason ?? "").trim())
    .map((skip) => skip.surface);
}

/** Without GIT_DIR and the like: a hook sets them, and they would point git at the repository
 * being committed instead of `cwd`. */
const withoutGitEnv = () =>
  Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

const MAX_TAGLINE_WORDS = 6;
const MAX_HIGHLIGHTS = 3;
const MAX_HIGHLIGHT_WORDS = 5;
const MAX_LEAD_WORDS = 14;

const wordCount = (text) => String(text ?? "").trim().split(/\s+/).filter(Boolean).length;

/** The first slide and each lead are read in a glance: a long one is refused, not trimmed. */
function overlongText(plan) {
  const found = [];
  const { tagline, highlights = [] } = plan.intro ?? {};
  if (wordCount(tagline) > MAX_TAGLINE_WORDS) {
    found.push(`intro tagline: ${wordCount(tagline)} words, ${MAX_TAGLINE_WORDS} at most`);
  }
  if (highlights.length > MAX_HIGHLIGHTS) {
    found.push(`intro highlights: ${highlights.length}, ${MAX_HIGHLIGHTS} at most`);
  }
  highlights.forEach((text, i) => {
    if (wordCount(text) > MAX_HIGHLIGHT_WORDS) {
      found.push(`intro highlight ${i + 1}: ${wordCount(text)} words, ${MAX_HIGHLIGHT_WORDS} at most`);
    }
  });
  plan.scenes.forEach((scene, i) => {
    if (wordCount(scene.lead) > MAX_LEAD_WORDS) {
      found.push(`scene ${i + 1} lead: ${wordCount(scene.lead)} words, ${MAX_LEAD_WORDS} at most`);
    }
  });
  return found;
}

/** Words only the people who build AIDD know. A viewer reads the outcome in plain words; the demo
 * window may show the real commands. */
const JARGON = /\b(tokens?|envelopes?|axis|transcripts?|payloads?|hooks?)\b/gi;

function jargonIn(plan) {
  const found = [];
  const scan = (where, text) => {
    for (const [word] of String(text ?? "").matchAll(JARGON)) found.push(`${where}: "${word.toLowerCase()}"`);
  };
  const { tagline, highlights = [] } = plan.intro ?? {};
  scan("intro tagline", tagline);
  highlights.forEach((text, i) => scan(`intro highlight ${i + 1}`, text));
  plan.scenes.forEach((scene, i) => {
    for (const field of ["title", "accent", "lead"]) scan(`scene ${i + 1} ${field}`, scene[field]);
  });
  return found;
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", env: withoutGitEnv() }).trim();
}

/** Surfaces touched by `feat:` commits since the last release tag and still present at HEAD. */
function featSurfaces(cwd = ROOT) {
  const tag = git(cwd, "describe", "--tags", "--abbrev=0", "--match", "v[0-9]*");
  const log = git(cwd, "log", `${tag}..HEAD`, "--no-merges", "--format=%H%x09%s");
  const files = log
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"))
    .filter(([, subject]) => /^feat(\([^)]*\))?!?:/.test(subject))
    .flatMap(([sha]) =>
      git(cwd, "show", "--name-only", "--diff-filter=AM", "--format=", sha).split("\n")
    );
  return surfacesOf(files).filter((surface) => fs.existsSync(path.join(cwd, pathOf(surface))));
}

/** A theme (the pill, top left) groups what touches the same domain: its scenes follow each other. */
function splitThemes(plan) {
  const seen = new Set();
  const split = new Set();
  let current;
  for (const { pill } of plan.scenes) {
    if (pill !== current && seen.has(pill)) split.add(pill);
    seen.add(pill);
    current = pill;
  }
  return [...split];
}

function readPlan() {
  if (!fs.existsSync(PLAN_PATH)) return { scenes: [], skipped: [] };
  const plan = JSON.parse(fs.readFileSync(PLAN_PATH, "utf8"));
  return { intro: plan.intro, youtube: plan.youtube, scenes: plan.scenes ?? [], skipped: plan.skipped ?? [] };
}

function run({
  surfaces = featSurfaces(),
  plan = readPlan(),
  logger = console.error,
  successLogger = console.log,
} = {}) {
  const missing = missingScenes(surfaces, plan);
  const unexplained = invalidSkips(plan);
  const tooLong = overlongText(plan);
  const technical = jargonIn(plan);
  const split = splitThemes(plan);
  const youtube = plan.scenes.length > 0 ? youtubeProblems(plan) : [];

  if (missing.length === 0 && unexplained.length === 0 && tooLong.length === 0 && technical.length === 0 && split.length === 0 && youtube.length === 0) {
    successLogger(`✅ Release video: ${surfaces.length} surface(s) covered`);
    return 0;
  }

  if (missing.length > 0) logger(`❌ Scènes manquantes : ${missing.join(", ")}`);
  if (unexplained.length > 0) {
    logger(`❌ Surfaces ignorées sans raison : ${unexplained.join(", ")}`);
  }
  if (tooLong.length > 0) logger(`❌ Textes trop longs : ${tooLong.join(", ")}`);
  if (technical.length > 0) logger(`❌ Mots techniques : ${technical.join(", ")}`);
  if (split.length > 0) logger(`❌ Thèmes dispersés : ${split.join(", ")}`);
  if (youtube.length > 0) logger(`❌ Texte YouTube : ${youtube.join(", ")}`);
  return 1;
}

module.exports = { featSurfaces, invalidSkips, jargonIn, missingScenes, overlongText, readPlan, run, splitThemes, surfacesOf };

if (require.main === module) {
  process.exit(run());
}
