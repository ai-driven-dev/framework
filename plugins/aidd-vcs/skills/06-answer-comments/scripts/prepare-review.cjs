#!/usr/bin/env node
"use strict";
// Usage: node prepare-review.cjs --input <review.json>
// Pure preparation: no network or writes. JSON on stdout; exit 0 prepared, 1 refused, 2 usage/read error.
const fs = require("node:fs");
const { createHash } = require("node:crypto");
const MARKER = "<!-- aidd-answer-comments-summary -->";
const STATE = "<!-- aidd-answer-comments-state ";
const KINDS = ["done", "answer", "user-call", "todo", "decided"];
const fail = (message) => { throw new Error(message); };
const filled = (value) => typeof value === "string" && value.trim().length > 0;
const array = (value, name) => Array.isArray(value) ? value : fail(`${name} must be an array.`);
const text = (value, name) => filled(value) ? value : fail(`${name} must be non-empty text.`);
const line = (value, name) => /[\r\n]/.test(text(value, name)) ? fail(`${name} must be one line.`) : value;
const object = (value, name) => value && typeof value === "object" && !Array.isArray(value) ? value : fail(`${name} must be an object.`);
const observationOf = (thread) => createHash("sha256").update(JSON.stringify([thread.lastReplyId ?? null, thread.lastReply ?? null])).digest("hex");

function index(items, key, name) {
  const result = new Map();
  for (const item of array(items, name)) {
    object(item, name);
    const id = line(item[key], `${name}.${key}`);
    if (result.has(id) && JSON.stringify(result.get(id)) !== JSON.stringify(item)) fail(`${name}: conflicting ${id}.`);
    result.set(id, item);
  }
  return result;
}

function classification(item, name, historical = false) {
  object(item, name);
  line(item.threadId, `${name}.threadId`);
  if (!KINDS.includes(item.kind) || (!historical && item.kind === "decided")) fail(`${name}: unsupported kind.`);
  text(item.text, `${name}.text`);
  if (item.text.split(/\r?\n/).length > 2) fail(`${name}.text must fit in two lines.`);
  if (["done", "answer", "decided"].includes(item.kind)) line(item.source, `${name}.source`);
  if (item.kind === "done" && !/^[a-f\d]{7,40}$/i.test(item.source)) fail(`${name}.source must be a pushed commit SHA.`);
  if (!historical && ["done", "answer"].includes(item.kind) && /\([^()]*\)\.?\s*$/.test(item.text)) fail(`${name}.text must not end with its source; the reply appends it.`);
  if (historical) {
    line(item.url, `${name}.url`);
    if (!/^[a-f\d]{64}$/.test(item.observation)) fail(`${name}.observation must be a reply fingerprint.`);
  }
}

function priorState(body) {
  if (!body.includes(STATE)) return { entries: [], learnings: [] };
  const parts = body.split(STATE);
  if (parts.length !== 2 || !parts[1].includes(" -->")) fail("Invalid review state.");
  let state;
  try { state = JSON.parse(parts[1].slice(0, parts[1].indexOf(" -->"))); }
  catch { fail("Invalid review state JSON."); }
  object(state, "review state");
  if (state.version !== 1) fail("Unsupported review state version.");
  const entries = index(state.entries, "threadId", "review state entries");
  for (const item of entries.values()) classification(item, "review state entry", true);
  return { entries: [...entries.values()], learnings: learnings(state.learnings) };
}

function learnings(items) {
  return array(items, "learnings").map((item) => {
    object(item, "learning");
    return { text: line(item.text, "learning.text"), url: line(item.url, "learning.url") };
  });
}

function targetOf(input) {
  const summaries = [...index(input.summaries ?? [], "id", "summaries").values()];
  for (const item of summaries) { line(item.author, "summary.author"); text(item.body, "summary.body"); }
  const owned = summaries.filter((item) => item.author === input.account);
  const marked = owned.filter((item) => item.body.includes(MARKER));
  const legacy = owned.filter((item) => !item.body.includes(MARKER) && item.body.startsWith("## Review comments"));
  const choice = input.summaryChoice;
  if (choice !== undefined) {
    line(choice, "summaryChoice");
    if (choice === "new") {
      if (marked.length) fail("Choose an existing marked summary.");
      return { status: "ready" };
    }
    const target = [...marked, ...(marked.length ? [] : legacy)].find((item) => item.id === choice);
    if (!target) fail("summaryChoice is not an eligible summary owned by the current account.");
    return { status: "ready", target };
  }
  if (marked.length === 1) return { status: "ready", target: marked[0] };
  if (marked.length || legacy.length) return { status: "needs-choice", candidates: (marked.length ? marked : legacy).map(({ id }) => id), allowNew: !marked.length };
  return { status: "ready" };
}

const flatten = (value) => value.replace(/\s*\r?\n\s*/g, " ").trim();
const withoutSuffix = (value) => value.replace(/\s*(?:Answer here\.|To do\.)\s*$/, "").trim();
function replyOf(item) {
  const value = withoutSuffix(item.text);
  if (item.kind === "user-call") return `${value} Answer here.`;
  if (item.kind === "todo") return `${value} To do.`;
  if (item.kind === "decided") return `Decision: ${value}`;
  return `${value} (${item.kind === "done" ? item.source.slice(0, 9) : item.source})`;
}

function render(entries, lessons, pendingThreads) {
  const values = [...entries.values()].sort((a, b) => a.threadId.localeCompare(b.threadId));
  const done = values.filter((item) => item.kind === "done");
  const shas = [...new Set(done.map((item) => item.source.slice(0, 9)))];
  const lines = ["## Review comments", "", MARKER, "", `Done: ${done.length}${shas.length ? ` (${shas.join(", ")})` : ""}. Answered: ${values.filter((item) => item.kind === "answer").length}.`];
  for (const [kind, heading] of [["user-call", "FAQ: your call"], ["todo", "To do"]]) {
    const pending = pendingThreads.filter((item) => item.kind === kind);
    if (pending.length) lines.push("", `### ${heading}`, "", ...pending.map((item, i) => kind === "user-call" ? `${i + 1}. **${flatten(withoutSuffix(item.text))}** ([thread](${item.url}))` : `- ${flatten(withoutSuffix(item.text))} ([thread](${item.url}))`));
  }
  if (lessons.length) lines.push("", "### Learnings to keep", "", ...lessons.map((item) => `- ${item.text} ([thread](${item.url}))`));
  const state = JSON.stringify({ version: 1, entries: values, learnings: lessons }).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  return `${lines.join("\n")}\n\n${STATE}${state} -->`;
}

function prepare(input) {
  object(input, "input");
  line(input.account, "account");
  const threads = index(input.threads, "id", "threads");
  const outOfScope = (thread) => thread.resolved && !thread.replyAuthors.includes(input.account);
  for (const item of threads.values()) {
    line(item.url, "thread.url");
    if (typeof item.resolved !== "boolean") fail("thread.resolved must be boolean.");
    array(item.replyAuthors, "thread.replyAuthors").forEach((author) => line(author, "thread.replyAuthors[]"));
    if (item.lastReply !== undefined && typeof item.lastReply !== "string") fail("thread.lastReply must be text.");
    if (item.lastReplyId !== undefined) line(item.lastReplyId, "thread.lastReplyId");
    if (item.newCommit !== undefined && typeof item.newCommit !== "boolean") fail("thread.newCommit must be boolean.");
  }
  const classes = index(input.classifications ?? [], "threadId", "classifications");
  for (const item of classes.values()) {
    classification(item, "classification");
    if (!threads.has(item.threadId)) fail(`Unknown classification thread ${item.threadId}.`);
    if (outOfScope(threads.get(item.threadId))) fail(`Thread ${item.threadId} is resolved and the current account never replied in it; leave it unclassified.`);
  }
  const decisions = index(input.decisions ?? [], "threadId", "decisions");
  for (const item of decisions.values()) {
    text(item.text, "decision.text"); line(item.source, "decision.source");
    if (item.text.split(/\r?\n/).length > 2) fail("decision.text must fit in two lines.");
    if (!threads.has(item.threadId)) fail(`Unknown decision thread ${item.threadId}.`);
  }
  const selection = targetOf(input);
  const prior = selection.target ? priorState(selection.target.body) : { entries: [], learnings: [] };
  const entries = new Map(prior.entries.map((item) => [item.threadId, item]));
  const operations = [];
  const unknown = [];
  for (const thread of threads.values()) {
    if (outOfScope(thread)) continue;
    const decision = decisions.get(thread.id);
    const old = entries.get(thread.id);
    const observation = observationOf(thread);
    const sameReply = old?.observation === observation;
    const reusable = old && (thread.resolved || sameReply || thread.lastReply === replyOf(old));
    const settled = !thread.resolved && old?.kind === "decided" && reusable;
    let item = decision ? { threadId: thread.id, kind: "decided", text: decision.text, source: decision.source } : settled ? old : classes.get(thread.id) ?? (reusable ? old : undefined);
    if (!item) { entries.delete(thread.id); unknown.push(thread.id); continue; }
    const waitsForDecision = !thread.resolved && thread.lastReply?.trimEnd().endsWith("Answer here.") && item.kind !== "decided";
    const waitsForCommit = !thread.resolved && thread.lastReply?.trimEnd().endsWith("To do.") && !thread.newCommit;
    if (waitsForDecision && item.kind !== "user-call") fail(`Thread ${thread.id} awaits a decision.`);
    if (waitsForCommit && item.kind !== "todo" && item.kind !== "decided") fail(`Thread ${thread.id} awaits a pushed commit.`);
    item = { ...item, url: thread.url, observation };
    entries.set(thread.id, item);
    if (thread.resolved || waitsForDecision || (waitsForCommit && item.kind !== "decided")) continue;
    const reply = replyOf(item);
    const resolve = ["done", "answer", "decided"].includes(item.kind);
    const operation = { threadId: thread.id };
    if (reply !== thread.lastReply) operation.reply = reply;
    if (resolve) operation.resolve = true;
    if (operation.reply || operation.resolve) operations.push(operation);
  }
  const lessons = [...new Map([...prior.learnings, ...learnings(input.learnings ?? [])].map((item) => [JSON.stringify(item), item])).values()];
  const pending = [...entries.values()].filter((item) => threads.has(item.threadId) && !threads.get(item.threadId).resolved && ["user-call", "todo"].includes(item.kind));
  let summary;
  if (selection.status === "needs-choice") summary = selection;
  else if (unknown.length) summary = { status: "unknown" };
  else {
    const body = render(entries, lessons, pending);
    summary = { status: "ready", operation: selection.target ? selection.target.body === body ? "unchanged" : "update" : "create", ...(selection.target ? { targetId: selection.target.id } : {}), body };
  }
  return { threads: operations, pending, summary, unknown };
}

try {
  if (process.argv.length !== 4 || process.argv[2] !== "--input") throw Object.assign(new Error("Usage: node prepare-review.cjs --input <review.json>"), { usage: true });
  let input;
  try { input = JSON.parse(fs.readFileSync(process.argv[3], "utf8")); }
  catch (error) { throw Object.assign(new Error(`Cannot read review JSON: ${error.message}`), { usage: true }); }
  process.stdout.write(`${JSON.stringify(prepare(input), null, 2)}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exitCode = error.usage ? 2 : 1;
}
