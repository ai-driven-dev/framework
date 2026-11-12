#!/usr/bin/env node
/**
 * Runs the aidd-ui skills in chain, with Haiku, on throwaway copies of three projects (a blank
 * one and two real checkouts), then checks without AI what the chain left: the engine's verdict,
 * a wireframe behind every journey step, and the project's code untouched. Run it by hand after
 * a change to the plugin; nothing calls it. Each step must also change only its own files
 * and the engine files it drives, and at least one of its own. A hand-written history
 * and an engine-written one cannot be told apart.
 *
 * The copies keep the tracked files of a checkout and nothing else, made by `git archive`, so the
 * checkout itself is only read. They live under the system temp folder (set `TMPDIR` to choose
 * it), are kept, and their paths are printed. Remove them with
 * `rm -rf "${TMPDIR:-/tmp}"/aidd-ui-pilot-*`.
 *
 * A step may delete a file only through `Bash(rm aidd_docs/ui/*)`: a real user would approve that `rm`,
 * the pilot cannot. The rule is a text match, so `..` in the path would escape it; the step check on
 * files outside its own set still catches that.
 *
 * Warnings follow the model's choices (the code roots and platforms it picks) and do not count:
 * compare the errors, the wireframes and the code.
 *
 * Usage: node scripts/aidd-ui-pilot.cjs --gouvernail <checkout> --kairos <checkout> [--only blank|gouvernail|kairos]
 *
 * Exit codes:
 *   0  no pilot has an error, every step has its wireframe, the code is untouched and each step stayed in its files
 *   1  any error, a missing wireframe, changed code, or a step outside its files
 *   2  a step could not run
 */
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "plugins", "aidd-ui");
const ENGINE = path.join(PLUGIN, "hooks", "aidd-ui.cjs");
const { load } = require(path.join(PLUGIN, "hooks", "lib", "project.cjs"));
const { table } = require(path.join(PLUGIN, "hooks", "lib", "markdown.cjs"));
const { STEPS_SECTION } = require(path.join(PLUGIN, "hooks", "lib", "model.cjs"));

const UI_DIR = "aidd_docs/ui";
const GIT_DIR = ".git";
const VALID = "VALID";
const RULE_ID = /^[A-Z]\d+$/;
const STEP_TIMEOUT_MS = 40 * 60_000;
const ALLOWED_TOOLS = "Read,Write,Edit,Glob,Grep,Skill,Bash(node:*),Bash(ls:*),Bash(git ls-files:*),Bash(rm aidd_docs/ui/*)";
const GIT = ["-c", "user.name=aidd-ui-pilot", "-c", "user.email=pilot@localhost", "-c", "core.hooksPath=/dev/null"];

/** The environment without a git variable: a hook sets GIT_DIR and GIT_INDEX_FILE, which would aim git at the caller's repository. */
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")));

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

/** Every file under `dir` as relative path to content hash, `.git/` left out. */
function snapshot(dir) {
  const files = {};
  const visit = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      const name = path.relative(dir, full).split(path.sep).join("/");
      if (entry.isSymbolicLink()) files[name] = fs.readlinkSync(full);
      else if (entry.isDirectory()) {
        if (entry.name !== GIT_DIR) visit(full);
      } else files[name] = sha256(full);
    }
  };
  visit(dir);
  return files;
}

/** The files added, modified or deleted between two snapshots, sorted. */
function changedBetween(before, after) {
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...paths].filter((file) => before[file] !== after[file]).sort();
}

/** The files changed between two snapshots outside `aidd_docs/ui/`, sorted. */
const changedOutsideUi = (before, after) => changedBetween(before, after).filter((file) => !file.startsWith(`${UI_DIR}/`));

// What each skill writes under `aidd_docs/ui/`, as its SKILL.md "Write only" line says; a folder ends with `/`.
const OWNED = {
  "01-journeys": ["journeys/", "wireframes/"],
  "02-brand": ["brand.md"],
  "03-foundations": ["system.md", "tokens.json", "themes/", "platforms/", "breakpoints/"],
  "04-components": ["components/", "assets/"],
};
// What the engine writes for each skill's step. The history is the engine's, and a model could write it by hand: the snapshot cannot tell the two apart.
const ENGINE_FILES = {
  "01-journeys": ["history.md"],
  "02-brand": ["drafts/.gitignore"],
  "03-foundations": ["history.md", "code-debt.json", "tokens.css", "tokens.resolver.json"],
  "04-components": ["history.md", "tokens.css", "tokens.resolver.json"],
};

const isIn = (file, entries) => entries.some((entry) => (entry.endsWith("/") ? file.startsWith(`${UI_DIR}/${entry}`) : file === `${UI_DIR}/${entry}`));

/** What a step got wrong between two snapshots: each file it changed outside its set and the
 * engine's files, then, when it changed none of its own, that. */
function stepBreaks(skill, before, after) {
  const changed = changedBetween(before, after);
  const outside = changed.filter((file) => !isIn(file, [...OWNED[skill], ...ENGINE_FILES[skill]]));
  return [...outside.map((file) => `${skill} wrote ${file}`), ...(changed.some((file) => isIn(file, OWNED[skill])) ? [] : [`${skill} wrote none of its files`])];
}

/** The tracked files of `source` copied into the empty `dest`, as a git repository with one commit.
 * The source is only read, by `git archive`. */
function copyProject(source, dest) {
  const archive = spawnSync("git", ["-C", source, "archive", "HEAD"], { maxBuffer: 2 ** 32, env: cleanEnv() });
  if (archive.status !== 0) throw new Error(`git archive failed in the source: ${archive.stderr}`);
  // Run in `dest`, never `-C dest`: GNU tar reads a Windows `C:\…` path as a remote host.
  const unpack = spawnSync("tar", ["-x"], { input: archive.stdout, cwd: dest });
  if (unpack.status !== 0) throw new Error(`tar failed: ${unpack.stderr}`);
  for (const args of [["init", "-q"], ["add", "-A"], ["commit", "-q", "-m", "pilot copy", "--no-verify"]]) {
    const run = spawnSync("git", [...GIT, ...args], { cwd: dest, encoding: "utf8", env: cleanEnv() });
    if (run.status !== 0) throw new Error(`git ${args[0]} failed in the copy: ${run.stderr}`);
  }
}

/** The sorted unique rule ids `validate` prints for `root`, the errors apart from the warnings: the
 * engine marks a warning line with `warning` after its rule. */
function verdict(root) {
  const run = spawnSync(process.execPath, [ENGINE, "validate", root], { encoding: "utf8" });
  const out = run.stdout.trim();
  const found = { errors: new Set(), warnings: new Set() };
  if (out === VALID) return { errors: [], warnings: [] };
  for (const line of out.split("\n").slice(1)) {
    const words = line.split(" ");
    const at = words.findIndex((word) => RULE_ID.test(word));
    if (at >= 0) found[words[at + 1] === "warning" ? "warnings" : "errors"].add(words[at]);
  }
  if (!found.errors.size && !found.warnings.size) throw new Error(`validate printed no rule: ${out || run.stderr}`);
  return { errors: [...found.errors].sort(), warnings: [...found.warnings].sort() };
}

/** Each journey step whose screen is no wireframe record, or null when nothing loads or no step exists. */
function stepsWithoutWireframe(root) {
  const project = load(root);
  if (project === null) return null;
  const kindOf = (record) => record.frontMatter.kind;
  const wireframes = new Set(project.records.filter((record) => kindOf(record) === "wireframe").map((record) => record.frontMatter.id));
  const steps = project.records
    .filter((record) => kindOf(record) === "journey")
    .flatMap((record) => table(record.sections[STEPS_SECTION]).map((row, at) => ({ journey: record.frontMatter.id, step: at + 1, screen: row.Screen })));
  return steps.length ? steps.filter((step) => !wireframes.has(step.screen)) : null;
}

/** One pilot's result on one line. */
function reportLine(pilot, { errors, warnings, missing, changed, broken }) {
  const ids = (list) => (list.length ? list.join(",") : "none");
  const wireframes = missing === null ? "no journey" : missing.length ? `missing ${missing.length}` : "all";
  const code = changed.length ? `changed ${changed.length}` : "untouched";
  const steps = broken.length ? `broken ${broken.length}` : "ok";
  return `${pilot} errors ${ids(errors)} warnings ${ids(warnings)} wireframes ${wireframes} code ${code} steps ${steps}`;
}

// What each pilot asks, one part per skill of the chain.
const NON_INTERACTIVE = (part) =>
  `You run non-interactively: whenever the skill would ask the user, take the answer given, or the most reasonable one, state each choice in your final reply, and go on; write no file the skill does not name; the user agrees with what you propose. Never install anything, never run the project's own scripts or package manager; read its files only, and run only node with the aidd-ui engine. Task folder: aidd_docs/tasks/${part}.`;

const REQUESTS = {
  blank: {
    journeys:
      "A breathing-exercise app, web and mobile, built from nothing: no code, no design system yet. Persona: Lea, 34, an office worker new to breathwork, who wants to calm down in two minutes between meetings. Journeys: her first guided session, from opening the app to finishing it; and setting a daily reminder.",
    brand:
      'Lay the design system of this breathing-exercise app from scratch: no UI code exists. Its journeys and wireframes are already in aidd_docs/ui/. Propose three directions for it, compare them and keep the one that fits. Brand: "Breath", calm, soft, reassuring; for Lea, 34, an office worker new to breathwork who wants to calm down in two minutes between meetings; light theme only; English.',
    foundations: "Write the tokens, for web and mobile.",
    components: "Write the components the wireframes expect.",
  },
  real: {
    journeys:
      "Map two journeys of this existing app from its real screens, for its main user, with a wireframe per step. Persona: take one a brief under aidd_docs describes, else the app's main user as its README describes.",
    brand: "Lay the design system of this existing app from its code. Write its brand from its README, package manifest and visible copy.",
    foundations: "Write its tokens from its code.",
    components: "Write the components its screens use, at most eight, the ones the wireframes expect first.",
  },
};

/** The chain: each step a skill and the part it receives, in order. */
const CHAIN = [
  ["01-journeys", "journeys"],
  ["02-brand", "brand"],
  ["03-foundations", "foundations"],
  ["04-components", "components"],
];

/** The request of one step: its part, then the non-interactive suffix. */
const requestOf = (pilot, skill, part) => `/aidd-ui:${skill} ${REQUESTS[pilot][part]} ${NON_INTERACTIVE(part)}`;

/** The folders of `~/.claude/projects` holding the chat of the copy `dir`: Claude names a folder
 * after the path it ran in, so it ends with the copy's two last folder names. */
const chatsOf = (names, dir) => names.filter((name) => name.endsWith(`-${path.basename(path.dirname(dir))}-${path.basename(dir)}`));

/** Deletes the chats a run in `dir` left, `--no-session-persistence` keeping only its tool results. */
function forgetChats(dir) {
  const projects = path.join(os.homedir(), ".claude", "projects");
  if (!fs.existsSync(projects)) return;
  for (const name of chatsOf(fs.readdirSync(projects), dir)) fs.rmSync(path.join(projects, name), { recursive: true, force: true });
}

/** The arguments of one step: a stream of events, so the commands, the tool results and the hook messages stay readable. */
const stepArgs = ["-p", "--model", "haiku", "--no-session-persistence", "--plugin-dir", PLUGIN, "--setting-sources", "local", "--allowedTools", ALLOWED_TOOLS, "--output-format", "stream-json", "--verbose", "--include-hook-events"];

/** The text of a tool result, which Claude gives as a string or as blocks. */
const textOf = (content) => (typeof content === "string" ? content : (content ?? []).map((block) => block.text ?? "").join("\n"));

/** Reads a stream of events: `trace` holds one line per hook message, text, command and tool result; `reply` is the final reply. */
function traceOf(stream) {
  const entries = [];
  let reply = "";
  for (const raw of stream.split("\n")) {
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      continue;
    }
    if (event.type === "result") reply = event.result ?? "";
    if (event.type === "system" && event.subtype === "hook_response" && event.output) entries.push({ kind: "hook", name: event.hook_name, exit: event.exit_code, output: event.output });
    for (const block of event.message?.content ?? []) {
      if (block.type === "text") entries.push({ kind: "text", text: block.text });
      if (block.type === "tool_use") entries.push({ kind: "call", tool: block.name, input: block.input });
      if (block.type === "tool_result") entries.push({ kind: "result", error: block.is_error === true, content: textOf(block.content) });
    }
  }
  return { trace: entries.map((entry) => `${JSON.stringify(entry)}\n`).join(""), reply };
}

/** Runs one step in `cwd`; its reply goes to `outFile` and its trace beside it, in `<name>.trace.jsonl`. Returns whether claude exited 0. */
function runStep(cwd, request, outFile, [command, ...prefix] = ["claude"]) {
  const run = spawnSync(command, [...prefix, ...stepArgs], { cwd, input: request, encoding: "utf8", timeout: STEP_TIMEOUT_MS, maxBuffer: 2 ** 28 });
  const { trace, reply } = traceOf(run.stdout ?? "");
  fs.writeFileSync(outFile, `${reply}${run.stderr ?? ""}\nexit ${run.status}\n`);
  fs.writeFileSync(outFile.replace(/\.out$/, ".trace.jsonl"), trace);
  forgetChats(cwd);
  return run.status === 0;
}

/** The pilots to run as `[name, checkout]` (null for blank) from the command line, or null when a checkout is missing or `--only` names no pilot. */
function pilotsOf(argv) {
  const argumentOf = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const [gouvernail, kairos, only] = [argumentOf("--gouvernail"), argumentOf("--kairos"), argumentOf("--only")];
  if (!gouvernail || !kairos) return null;
  const pilots = [["blank", null], ["gouvernail", gouvernail], ["kairos", kairos]].filter(([name]) => !only || only === name);
  return pilots.length ? pilots : null;
}

/** Runs the pilots and returns the exit code; any step that throws gives 2 with its message. `steps` lets a test replace the copy and the model run. */
function main(argv = process.argv.slice(2), steps = { copyProject, runStep }) {
  const pilots = pilotsOf(argv);
  if (!pilots) {
    console.error("usage: node scripts/aidd-ui-pilot.cjs --gouvernail <checkout> --kairos <checkout> [--only blank|gouvernail|kairos]");
    return 2;
  }
  try {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-ui-pilot-"));
    console.log(`copies in ${base}`);
    let worst = 0;
    for (const [pilot, source] of pilots) {
      const dir = path.join(base, pilot);
      fs.mkdirSync(dir);
      if (source) steps.copyProject(source, dir);
      const before = snapshot(dir);
      let last = before;
      const broken = [];
      for (const [skill, part] of CHAIN) {
        if (!steps.runStep(dir, requestOf(source ? "real" : "blank", skill, part), path.join(base, `${pilot}.${skill}.out`))) {
          console.log(`${pilot} step ${skill} could not run, see ${base}/${pilot}.${skill}.out`);
          return 2;
        }
        const now = snapshot(dir);
        broken.push(...stepBreaks(skill, last, now));
        last = now;
      }
      const result = { ...verdict(dir), missing: stepsWithoutWireframe(dir), changed: changedOutsideUi(before, last), broken };
      console.log(reportLine(pilot, result));
      for (const line of broken) console.log(line);
      if (result.errors.length || result.missing === null || result.missing.length || result.changed.length || broken.length) worst = 1;
    }
    return worst;
  } catch (error) {
    console.error(error.message);
    return 2;
  }
}

if (require.main === module) process.exit(main());

module.exports = { copyProject, snapshot, changedOutsideUi, stepBreaks, verdict, stepsWithoutWireframe, reportLine, requestOf, CHAIN, REQUESTS, OWNED, ENGINE_FILES, chatsOf, pilotsOf, main, stepArgs, traceOf, runStep };
