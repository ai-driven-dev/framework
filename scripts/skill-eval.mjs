#!/usr/bin/env node
// Behavioral eval harness for framework skills. Each case runs the selected host CLI
// in an isolated temp project with a uniquely named worktree skill. Local and opt-in:
// the host needs authentication and each live case spends tokens.

import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { treeSnapshot } from "./skill-eval-snapshot.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const skillsDir = (c) => join(ROOT, "plugins", c.plugin || "aidd-refine", "skills");
const CASES = JSON.parse(readFileSync(join(HERE, "skill-eval", "cases.json"), "utf8"));

const args = process.argv.slice(2);
const JUDGE = args.includes("--judge");
const KEEP = args.includes("--keep");
const MODEL = args.find((a) => a.startsWith("--model="))?.slice("--model=".length);
const HOST = args.find((a) => a.startsWith("--host="))?.slice("--host=".length) || "claude";
if (!new Set(["claude", "codex"]).has(HOST)) {
  console.error(`Unsupported host: ${HOST}. Use --host=claude or --host=codex.`);
  process.exit(2);
}
function positiveIntegerOption(name, fallback) {
  const option = args.find((a) => a.startsWith(`${name}=`));
  const raw = option === undefined ? String(fallback) : option.slice(name.length + 1);
  const value = Number(raw);
  if (!/^\d+$/u.test(raw) || !Number.isSafeInteger(value) || !Number.isFinite(value) || value <= 0) {
    console.error(`${name} must be a finite positive integer; received "${raw}".`);
    process.exit(2);
  }
  return value;
}
const JOBS = positiveIntegerOption("--jobs", 4);
const filter = args.find((a) => !a.startsWith("--"));
const REPEAT = positiveIntegerOption("--repeat", 1);
const CASE = (args.find((a) => a.startsWith("--case=")) || "--case=").split("=")[1];
const selected = CASES.filter(
  (c) => (!filter || c.skill === filter || c.plugin === filter) && (!CASE || c.name.toLowerCase().includes(CASE.toLowerCase())),
);
// A skill is not deterministic. Repeating a case turns "it failed" into a rate.
const cases = selected.flatMap((c) => Array.from({ length: REPEAT }, (_, i) => (REPEAT > 1 ? { ...c, name: `${c.name} [${i + 1}/${REPEAT}]` } : c)));

if (cases.length === 0) {
  console.error(`No cases match ${filter ? `"${filter}"` : "(any)"}.`);
  process.exit(2);
}

function runHost(prompt, cwd, host = HOST) {
  return new Promise((ok, ko) => {
    const codexOutput = join(cwd, ".skill-eval-last-message.txt");
    const command = host === "codex" ? "codex" : "claude";
    // Codex uses the same project skill bytes in .agents/skills. Both hosts
    // receive the isolated fixture as their working directory.
    const commandArgs = host === "codex"
      ? ["exec", "-C", cwd, "-s", "workspace-write", "--ephemeral", "--skip-git-repo-check", "-o", codexOutput, ...(MODEL ? ["-m", MODEL] : []), prompt]
      : ["-p", prompt, ...(MODEL ? ["--model", MODEL] : []), "--setting-sources", "project,local", "--add-dir", cwd, "--dangerously-skip-permissions"];
    const child = spawn(
      command,
      commandArgs,
      { cwd, timeout: 600000 },
    );
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", ko);
    child.on("close", (code, signal) => {
      if (code !== 0) return ko(new Error(`${command} exited ${code ?? signal}: ${out.trim().slice(-400)}`));
      if (host === "codex") {
        if (!existsSync(codexOutput)) return ko(new Error("codex did not write its final response"));
        const finalResponse = readFileSync(codexOutput, "utf8");
        if (!finalResponse.trim()) return ko(new Error("codex wrote an empty final response"));
        return ok(finalResponse);
      }
      ok(out);
    });
    child.stdin.end();
  });
}

function has(haystack, needle) {
  return haystack.toLowerCase().includes(String(needle).toLowerCase());
}

// One assertion = { ok: boolean, label: string }
async function evaluate(expect, ctx) {
  const checks = [];
  const fileText = (name) => (existsSync(join(ctx.tmp, name)) ? readFileSync(join(ctx.tmp, name), "utf8") : null);

  for (const name of expect.filesExist || []) {
    checks.push({ ok: existsSync(join(ctx.tmp, name)), label: `file exists: ${name}` });
  }
  for (const name of expect.filesAbsent || []) {
    checks.push({ ok: !existsSync(join(ctx.tmp, name)), label: `file absent: ${name}` });
  }
  // The only way to assert that a read-only action stayed read-only.
  for (const name of expect.filesUnchanged || []) {
    const before = ctx.setup[name];
    checks.push({ ok: before != null && fileText(name) === before, label: `file unchanged: ${name}` });
  }
  for (const name of expect.jsonValid || []) {
    const text = fileText(name);
    let ok = false;
    try {
      if (text != null) JSON.parse(text);
      ok = text != null;
    } catch {
      ok = false;
    }
    checks.push({ ok, label: `valid JSON: ${name}` });
  }
  for (const [name, subs] of Object.entries(expect.fileContains || {})) {
    const text = fileText(name);
    for (const s of subs) checks.push({ ok: text != null && has(text, s), label: `${name} contains "${s}"` });
  }
  // The only way to assert a file's whole shape, not just its parts.
  for (const [name, re] of Object.entries(expect.fileMatches || {})) {
    const text = fileText(name);
    checks.push({ ok: text != null && new RegExp(re).test(text), label: `${name} matches /${re}/` });
  }
  for (const [name, subs] of Object.entries(expect.fileNotContains || {})) {
    const text = fileText(name);
    for (const s of subs) checks.push({ ok: text != null && !has(text, s), label: `${name} omits "${s}"` });
  }
  for (const s of expect.stdoutContains || []) {
    checks.push({ ok: has(ctx.stdout, s), label: `stdout contains "${s}"` });
  }
  for (const s of expect.stdoutNotContains || []) {
    checks.push({ ok: !has(ctx.stdout, s), label: `stdout omits "${s}"` });
  }
  for (const re of expect.stdoutMatches || []) {
    checks.push({ ok: new RegExp(re, "i").test(ctx.stdout), label: `stdout matches /${re}/` });
  }

  if (expect.judge) {
    if (!JUDGE) {
      checks.push({ ok: null, skipped: true, label: `judge (skipped, pass --judge): ${expect.judge}` });
    } else {
      const evidence = [ctx.stdout, ...(expect.judgeFiles || []).map((n) => fileText(n) || "")].join("\n\n");
      const verdict = await runHost(
        `You grade a test. Criterion: "${expect.judge}". Output under test follows between <<< and >>>.\n` +
          `Reply with exactly PASS or FAIL on the first line, then one line of reason.\n<<<\n${evidence}\n>>>`,
        ctx.tmp,
        HOST,
      );
      checks.push({
        ok: /^\s*pass\b/i.test(verdict),
        label: `judge: ${expect.judge}`,
        note: verdict.trim().split("\n").map((line) => line.trim()).join(" | "),
      });
    }
  }
  return checks;
}

function setupCase(c) {
  const tmp = mkdtempSync(join(tmpdir(), "skilleval-"));
  const skillDst = join(tmp, HOST === "codex" ? ".agents" : ".claude", "skills", c.evalName);
  mkdirSync(skillDst, { recursive: true });
  cpSync(join(skillsDir(c), c.skill), skillDst, { recursive: true });
  // A skill may run a script its plugin bundles. Stage it next to the skill so
  // the sandbox matches an installed plugin rather than a skill copied alone.
  const hooks = join(ROOT, "plugins", c.plugin || "aidd-refine", "hooks");
  if (existsSync(hooks)) cpSync(hooks, join(skillDst, "hooks"), { recursive: true });
  const skillMd = join(skillDst, "SKILL.md");
  const rewritten = readFileSync(skillMd, "utf8").replace(/^name:.*$/m, `name: ${c.evalName}`);
  writeFileSync(skillMd, rewritten);
  for (const [rel, content] of Object.entries(c.setup?.files || {})) {
    const dst = join(tmp, rel);
    mkdirSync(dirname(dst), { recursive: true });
    writeFileSync(dst, content);
  }
  return tmp;
}

async function runCase(c) {
  // setupCase can throw on a case whose skill folder is gone. Keep it inside the
  // guard: one broken case must not abort a suite that takes minutes to run.
  let tmp = null;
  let checks;
  let stdout = "";
  let beforeTree = null;
  try {
    tmp = setupCase(c);
    if (c.expect.projectTreeUnchanged) beforeTree = treeSnapshot(tmp);
    const prompt = c.prompt.replaceAll("{{SKILL}}", c.evalName);
    stdout = await runHost(prompt, tmp);
    checks = await evaluate(c.expect, { tmp, stdout, setup: c.setup?.files || {} });
    if (c.expect.repeat) {
      const before = treeSnapshot(tmp);
      const repeatOutput = await runHost(prompt, tmp);
      const after = treeSnapshot(tmp);
      const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
        (name) => before.get(name) !== after.get(name),
      );
      checks.push({
        ok: changed.length === 0,
        label: `idempotent rerun${changed.length ? ` changed: ${changed.join(", ")}` : " left project bytes and mtimes unchanged"}`,
      });
      if (!repeatOutput.trim()) checks.push({ ok: false, label: "idempotent rerun returned an empty response" });
    }
  } catch (err) {
    checks = [{ ok: false, label: `run error: ${err.message}` }];
  }
  if (beforeTree && tmp) {
    const afterTree = treeSnapshot(tmp);
    const changed = [...new Set([...beforeTree.keys(), ...afterTree.keys()])].filter(
      (name) => beforeTree.get(name) !== afterTree.get(name),
    );
    checks.push({
      ok: changed.length === 0,
      label: `project tree ${changed.length ? `changed: ${changed.join(", ")}` : "unchanged"}`,
    });
  }
  // A case that fails because the run itself failed looks identical to a case
  // that fails on the skill's behavior. Keep the tail so the two are separable.
  const broke = checks.some((k) => k.ok === false);
  if (broke) {
    const tail = stdout.trim().slice(-400).replace(/\s+/g, " ");
    checks.push({ ok: true, skipped: true, label: `run said: ${tail || "(nothing)"}` });
  }
  if (!KEEP && tmp) rmSync(tmp, { recursive: true, force: true });
  // Report as each case lands, in one write so parallel cases never interleave.
  // A long suite that is interrupted still leaves every finished case behind.
  const judgeSkipped = checks.some((k) => k.skipped && k.label.startsWith("judge (skipped"));
  const status = broke ? "FAIL" : judgeSkipped ? "INCOMPLETE (judge skipped)" : "PASS";
  const lines = [`${status}  ${c.skill}  ::  ${c.name}`];
  for (const k of checks) {
    lines.push(`   ${k.skipped ? "~" : k.ok ? "✓" : "✗"} ${k.label}${k.note ? `  (${k.note})` : ""}`);
  }
  if (KEEP && tmp) lines.push(`   tmp: ${tmp}`);
  console.log(`${lines.join("\n")}\n`);
  return { c, checks, tmp };
}

// Cases are independent, each in its own temp project, so they run concurrently.
// The cap keeps a large suite from spawning one `claude` per case at once.
async function runAll(list, jobs) {
  const out = [];
  let next = 0;
  const worker = async () => {
    while (next < list.length) out[next] = await runCase(list[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(jobs, list.length) }, worker));
  return out;
}

console.log(`Running ${cases.length} case(s) with ${HOST} on ${MODEL || "the host default model"}, ${JOBS} at a time${JUDGE ? ", with --judge" : ""}.\n`);
const results = await runAll(cases, JOBS);
const failed = results.filter(({ checks }) => checks.some((k) => k.ok === false)).length;
const judgesSkipped = results.reduce((count, { checks }) => count + checks.filter((check) =>
  check.skipped && check.label.startsWith("judge (skipped")
).length, 0);
const incomplete = results.filter(({ checks }) =>
  checks.some((check) => check.skipped && check.label.startsWith("judge (skipped")) &&
  !checks.some((check) => check.ok === false),
).length;
const passed = cases.length - failed - incomplete;
console.log(`${passed}/${cases.length} cases fully passed; ${incomplete} incomplete (judge skipped); ${failed} failed; ${judgesSkipped} judge evaluation(s) skipped${JUDGE ? "" : " (pass --judge to run them)"}.`);
process.exit(failed ? 1 : 0);
