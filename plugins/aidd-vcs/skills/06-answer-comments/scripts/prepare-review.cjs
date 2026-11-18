#!/usr/bin/env node
"use strict";
// Usage: node prepare-review.cjs --input <review.json>
// Pure preparation: no network or writes. JSON on stdout; exit 0 prepared, 1 refused, 2 usage/read error.
const fs = require("node:fs");
const { createHash } = require("node:crypto");

const SUMMARY_MARKER = "<!-- aidd-answer-comments-summary -->";
const STATE_OPEN = "<!-- aidd-answer-comments-state ";
const STATE_CLOSE = " -->";
const STATE_VERSION = 1;
const SUMMARY_HEADING = "## Review comments";
const kindMarker = (kind) => `<!-- aidd-answer-comments:${kind} -->`;
const NEW_SUMMARY = "new";
const SHORT_SHA_LENGTH = 9;
const MAX_TEXT_LINES = 2;
const COMMIT_SHA = /^[a-f\d]{7,40}$/i;
const FINGERPRINT = /^[a-f\d]{64}$/;
const TRAILING_SOURCE = /\([^()]*\)\.?\s*$/;
const DECIDED = "decided";
const CLASSIFIED_KINDS = ["done", "answer", "user-call", "todo"];
const STORED_KINDS = [...CLASSIFIED_KINDS, DECIDED];
const CITED_KINDS = ["done", "answer"];
const SOURCED_KINDS = [...CITED_KINDS, DECIDED];
const PENDING_SECTIONS = [["user-call", "FAQ: your call"], ["todo", "To do"]];

// Input checks: each returns its value or throws the refusal.
const fail = (message) => { throw new Error(message); };
const filled = (value) => typeof value === "string" && value.trim().length > 0;
const array = (value, name) => Array.isArray(value) ? value : fail(`${name} must be an array.`);
const text = (value, name) => filled(value) ? value : fail(`${name} must be non-empty text.`);
const line = (value, name) => /[\r\n]/.test(text(value, name)) ? fail(`${name} must be one line.`) : value;
const object = (value, name) => value && typeof value === "object" && !Array.isArray(value) ? value : fail(`${name} must be an object.`);
const short = (value, name) => text(value, name).split(/\r?\n/).length > MAX_TEXT_LINES ? fail(`${name} must fit in ${MAX_TEXT_LINES} lines.`) : value;

function index(items, key, name) {
  const result = new Map();
  for (const item of array(items, name)) {
    const id = line(object(item, name)[key], `${name}.${key}`);
    if (result.has(id) && JSON.stringify(result.get(id)) !== JSON.stringify(item)) fail(`${name}: conflicting ${id}.`);
    result.set(id, item);
  }
  return result;
}

function checkEntry(item, name, kinds) {
  object(item, name);
  line(item.threadId, `${name}.threadId`);
  if (!kinds.includes(item.kind)) fail(`${name}: unsupported kind.`);
  short(item.text, `${name}.text`);
  if (SOURCED_KINDS.includes(item.kind)) line(item.source, `${name}.source`);
  if (item.kind === "done" && !COMMIT_SHA.test(item.source)) fail(`${name}.source must be a pushed commit SHA.`);
}

function checkClassification(item) {
  checkEntry(item, "classification", CLASSIFIED_KINDS);
  if (CITED_KINDS.includes(item.kind) && TRAILING_SOURCE.test(item.text)) fail("classification.text must not end with its source; the reply appends it.");
}

function checkStoredEntry(item) {
  checkEntry(item, "review state entry", STORED_KINDS);
  line(item.url, "review state entry.url");
  if (!FINGERPRINT.test(item.observation)) fail("review state entry.observation must be a reply fingerprint.");
}

function checkThread(thread) {
  line(thread.url, "thread.url");
  if (typeof thread.resolved !== "boolean") fail("thread.resolved must be boolean.");
  array(thread.replyAuthors, "thread.replyAuthors").forEach((author) => line(author, "thread.replyAuthors[]"));
  if (thread.lastReply !== undefined && typeof thread.lastReply !== "string") fail("thread.lastReply must be text.");
  if (thread.lastReplyId !== undefined) line(thread.lastReplyId, "thread.lastReplyId");
  if (thread.newCommit !== undefined && typeof thread.newCommit !== "boolean") fail("thread.newCommit must be boolean.");
}

const learnings = (items) => array(items, "learnings").map((item) => {
  object(item, "learning");
  return { text: line(item.text, "learning.text"), url: line(item.url, "learning.url") };
});

// A resolved thread the current account never replied in belongs to someone else's history.
const outOfScope = (thread, account) => thread.resolved && !thread.replyAuthors.includes(account);

function readInput(input) {
  object(input, "input");
  const account = line(input.account, "account");
  const threads = index(input.threads, "id", "threads");
  threads.forEach(checkThread);
  const classifications = index(input.classifications ?? [], "threadId", "classifications");
  for (const item of classifications.values()) {
    checkClassification(item);
    if (!threads.has(item.threadId)) fail(`Unknown classification thread ${item.threadId}.`);
    if (outOfScope(threads.get(item.threadId), account)) fail(`Thread ${item.threadId} is resolved and the current account never replied in it; leave it unclassified.`);
  }
  const decisions = index(input.decisions ?? [], "threadId", "decisions");
  for (const item of decisions.values()) {
    short(item.text, "decision.text");
    line(item.source, "decision.source");
    if (!threads.has(item.threadId)) fail(`Unknown decision thread ${item.threadId}.`);
  }
  return { account, threads, classifications, decisions, learnings: learnings(input.learnings ?? []) };
}

// Summary targeting: only the current account's comments are candidates.
function selectSummary(input) {
  const summaries = [...index(input.summaries ?? [], "id", "summaries").values()];
  for (const item of summaries) { line(item.author, "summary.author"); text(item.body, "summary.body"); }
  const owned = summaries.filter((item) => item.author === input.account);
  const marked = owned.filter((item) => item.body.includes(SUMMARY_MARKER));
  const legacy = owned.filter((item) => !item.body.includes(SUMMARY_MARKER) && item.body.startsWith(SUMMARY_HEADING));
  if (input.summaryChoice !== undefined) return chosenSummary(line(input.summaryChoice, "summaryChoice"), marked, legacy);
  if (marked.length === 1) return { status: "ready", target: marked[0] };
  if (marked.length) return { status: "needs-choice", candidates: marked.map(({ id }) => id), allowNew: false };
  if (legacy.length) return { status: "needs-choice", candidates: legacy.map(({ id }) => id), allowNew: true };
  return { status: "ready" };
}

function chosenSummary(choice, marked, legacy) {
  if (choice === NEW_SUMMARY) return marked.length ? fail("Choose an existing marked summary.") : { status: "ready" };
  const eligible = marked.length ? marked : legacy;
  const target = eligible.find((item) => item.id === choice);
  return target ? { status: "ready", target } : fail("summaryChoice is not an eligible summary owned by the current account.");
}

function priorState(body) {
  if (!body.includes(STATE_OPEN)) return { entries: [], learnings: [] };
  const parts = body.split(STATE_OPEN);
  if (parts.length !== 2 || !parts[1].includes(STATE_CLOSE)) fail("Invalid review state.");
  let state;
  try { state = JSON.parse(parts[1].slice(0, parts[1].indexOf(STATE_CLOSE))); }
  catch { fail("Invalid review state JSON."); }
  object(state, "review state");
  if (state.version !== STATE_VERSION) fail("Unsupported review state version.");
  const entries = index(state.entries, "threadId", "review state entries");
  entries.forEach(checkStoredEntry);
  return { entries: [...entries.values()], learnings: learnings(state.learnings) };
}

// Replies: visible words are the model's, in the thread's language; a hidden kind marker lets a rerun recognize them.
const observationOf = (thread) => createHash("sha256").update(JSON.stringify([thread.lastReplyId ?? null, thread.lastReply ?? null])).digest("hex");
const flatten = (value) => value.replace(/\s*\r?\n\s*/g, " ").trim();
const shortSource = (item) => item.kind === "done" ? item.source.slice(0, SHORT_SHA_LENGTH) : item.source;

function replyOf(item) {
  const visible = CITED_KINDS.includes(item.kind) ? `${item.text} (${shortSource(item)})` : item.text;
  return `${visible}\n\n${kindMarker(item.kind)}`;
}

// A remembered entry still describes the thread when nothing new was said in it.
const stillCurrent = (thread, old) => Boolean(old) && (thread.resolved || old.observation === observationOf(thread) || thread.lastReply === replyOf(old));

function entryFor(thread, old, { classifications, decisions }) {
  const decision = decisions.get(thread.id);
  if (decision) return { threadId: thread.id, kind: DECIDED, text: decision.text, source: decision.source };
  const current = stillCurrent(thread, old);
  if (current && !thread.resolved && old.kind === DECIDED) return old;
  return classifications.get(thread.id) ?? (current ? old : undefined);
}

const lastReplyIs = (thread, kind) => !thread.resolved && Boolean(thread.lastReply?.trimEnd().endsWith(kindMarker(kind)));

// Returns whether the thread still waits; refuses a classification that would talk over the wait.
function stillWaits(thread, item) {
  const waitsForDecision = lastReplyIs(thread, "user-call") && item.kind !== DECIDED;
  const waitsForCommit = lastReplyIs(thread, "todo") && !thread.newCommit && item.kind !== DECIDED;
  if (waitsForDecision && item.kind !== "user-call") fail(`Thread ${thread.id} awaits a decision.`);
  if (waitsForCommit && item.kind !== "todo") fail(`Thread ${thread.id} awaits a pushed commit.`);
  return waitsForDecision || waitsForCommit;
}

function operationFor(thread, item) {
  const operation = { threadId: thread.id };
  const reply = replyOf(item);
  if (reply !== thread.lastReply) operation.reply = reply;
  if (SOURCED_KINDS.includes(item.kind)) operation.resolve = true;
  return operation.reply || operation.resolve ? operation : undefined;
}

function planThreads(review, priorEntries) {
  const entries = new Map(priorEntries.map((item) => [item.threadId, item]));
  const operations = [];
  const unknown = [];
  for (const thread of review.threads.values()) {
    if (outOfScope(thread, review.account)) continue;
    const item = entryFor(thread, entries.get(thread.id), review);
    if (!item) { entries.delete(thread.id); unknown.push(thread.id); continue; }
    const waits = stillWaits(thread, item);
    entries.set(thread.id, { ...item, url: thread.url, observation: observationOf(thread) });
    const operation = thread.resolved || waits ? undefined : operationFor(thread, item);
    if (operation) operations.push(operation);
  }
  return { entries, operations, unknown };
}

// Rendering: the visible summary, then its hidden state for the next run.
function countsLine(values) {
  const done = values.filter((item) => item.kind === "done");
  const shas = [...new Set(done.map(shortSource))];
  const answered = values.filter((item) => item.kind === "answer").length;
  return `Done: ${done.length}${shas.length ? ` (${shas.join(", ")})` : ""}. Answered: ${answered}.`;
}

function pendingSection(kind, heading, pending) {
  const items = pending.filter((item) => item.kind === kind);
  if (!items.length) return [];
  const bullet = (item, i) => kind === "user-call" ? `${i + 1}. **${flatten(item.text)}**` : `- ${flatten(item.text)}`;
  return ["", `### ${heading}`, "", ...items.map((item, i) => `${bullet(item, i)} ([thread](${item.url}))`)];
}

function render(entries, lessons, pending) {
  const values = [...entries.values()].sort((a, b) => a.threadId.localeCompare(b.threadId));
  const lines = [SUMMARY_HEADING, "", SUMMARY_MARKER, "", countsLine(values)];
  for (const [kind, heading] of PENDING_SECTIONS) lines.push(...pendingSection(kind, heading, pending));
  if (lessons.length) lines.push("", "### Learnings to keep", "", ...lessons.map((item) => `- ${item.text} ([thread](${item.url}))`));
  const state = JSON.stringify({ version: STATE_VERSION, entries: values, learnings: lessons }).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  return `${lines.join("\n")}\n\n${STATE_OPEN}${state}${STATE_CLOSE}`;
}

function planSummary(selection, unknown, body) {
  if (selection.status === "needs-choice") return selection;
  if (unknown.length) return { status: "unknown" };
  if (!selection.target) return { status: "ready", operation: "create", body };
  const operation = selection.target.body === body ? "unchanged" : "update";
  return { status: "ready", operation, targetId: selection.target.id, body };
}

function prepare(input) {
  const review = readInput(input);
  const selection = selectSummary(input);
  const prior = selection.target ? priorState(selection.target.body) : { entries: [], learnings: [] };
  const { entries, operations, unknown } = planThreads(review, prior.entries);
  const lessons = [...new Map([...prior.learnings, ...review.learnings].map((item) => [JSON.stringify(item), item])).values()];
  const isOpen = (item) => review.threads.has(item.threadId) && !review.threads.get(item.threadId).resolved;
  const pending = [...entries.values()].filter((item) => isOpen(item) && PENDING_SECTIONS.some(([kind]) => kind === item.kind));
  return { threads: operations, pending, summary: planSummary(selection, unknown, render(entries, lessons, pending)), unknown };
}

function main(argv) {
  if (argv.length !== 2 || argv[0] !== "--input") throw Object.assign(new Error("Usage: node prepare-review.cjs --input <review.json>"), { usage: true });
  let input;
  try { input = JSON.parse(fs.readFileSync(argv[1], "utf8")); }
  catch (error) { throw Object.assign(new Error(`Cannot read review JSON: ${error.message}`), { usage: true }); }
  return prepare(input);
}

try {
  process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)), null, 2)}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exitCode = error.usage ? 2 : 1;
}
