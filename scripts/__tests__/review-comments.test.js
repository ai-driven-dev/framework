const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const SCRIPT = path.resolve(__dirname, "../../plugins/aidd-vcs/skills/06-answer-comments/scripts/prepare-review.cjs");
const MARKER = "<!-- aidd-answer-comments-summary -->";
const posted = (text, kind) => `${text}\n\n<!-- aidd-answer-comments:${kind} -->`;
const thread = (id = "t1", more = {}) => ({ id, url: `https://example.com/${id}`, resolved: false, replyAuthors: ["me"], ...more });
const classification = (kind = "answer", more = {}) => ({ threadId: "t1", kind, text: "The code explains this.", source: "src/code.js", ...more });
const input = (more = {}) => ({ account: "me", threads: [thread()], classifications: [classification()], ...more });
const summary = (id = "s1", more = {}) => ({ id, author: "me", body: `## Review comments\n\n${MARKER}\n`, ...more });
function runner(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-review-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return (value) => {
    const file = path.join(dir, "review.json");
    fs.writeFileSync(file, JSON.stringify(value));
    const before = fs.readdirSync(dir);
    const process = spawnSync(global.process.execPath, [SCRIPT, "--input", file], { cwd: dir, env: { PATH: "" }, encoding: "utf8" });
    assert.deepEqual(fs.readdirSync(dir), before, "preparation writes no files");
    return { code: process.status, ...JSON.parse(process.stdout) };
  };
}

test("closed threads supply history, never replies, resolutions or pending questions", (t) => {
  const run = runner(t);
  const result = run(input({ threads: [thread("t1", { resolved: true })] }));
  assert.equal(result.code, 0);
  assert.deepEqual(result.threads, []);
  assert.match(result.summary.body, /Done: 0\. Answered: 1\./);
  const pending = run(input({ threads: [thread("t1", { resolved: true })], classifications: [classification("user-call")] }));
  assert.deepEqual(pending.pending, []);
  assert.doesNotMatch(pending.summary.body, /### FAQ/);
});

test("a supplied decision overrides a waiting question and is remembered on the next run", (t) => {
  const run = runner(t);
  const request = input({ threads: [thread("t1", { lastReply: posted("What next?", "user-call") })], classifications: [classification("user-call")], decisions: [{ threadId: "t1", text: "archive", source: "chat:message-1" }] });
  const result = run(request);
  assert.deepEqual(result.threads, [{ threadId: "t1", reply: posted("archive", "decided"), resolve: true }]);
  assert.deepEqual(result.pending, []);
  const again = run({ ...request, decisions: [], summaries: [summary("s1", { body: result.summary.body })] });
  assert.deepEqual(again.threads, result.threads);
  assert.equal(again.summary.operation, "unchanged");
  const acknowledged = run({ ...request, decisions: [], threads: [thread("t1", { lastReply: posted("archive", "decided") })], summaries: [summary("s1", { body: result.summary.body })] });
  assert.deepEqual(acknowledged.threads, [{ threadId: "t1", resolve: true }]);
});

test("a new message after a decision requires a fresh classification instead of resolving the reopened thread", (t) => {
  const run = runner(t);
  const first = run(input({ threads: [thread("t1", { lastReply: posted("What next?", "user-call") })], decisions: [{ threadId: "t1", text: "archive", source: "chat:message-1" }] }));
  const changed = input({ threads: [thread("t1", { lastReply: "What about the next release?" })], classifications: [classification("user-call", { text: "Keep or delete the next release?" })], summaries: [summary("s1", { body: first.summary.body })] });
  const result = run(changed);
  assert.deepEqual(result.threads, [{ threadId: "t1", reply: posted("Keep or delete the next release?", "user-call") }]);
  assert.equal(result.pending[0].kind, "user-call");
  assert.doesNotMatch(result.summary.body, /"kind":"decided"/);
  const missing = run({ ...changed, classifications: [] });
  assert.deepEqual(missing.threads, []);
  assert.deepEqual(missing.pending, []);
  assert.equal(missing.summary.status, "unknown");
  assert.deepEqual(missing.unknown, ["t1"]);
});

test("a new reply ID detects a repeated question without persisting its body", (t) => {
  const run = runner(t);
  const initialThread = thread("t1", { lastReply: posted("What next?", "user-call"), lastReplyId: "message-1" });
  const first = run(input({ threads: [initialThread], decisions: [{ threadId: "t1", text: "archive", source: "chat:message-1" }] }));
  assert.match(first.summary.body, /"observation":"[a-f\d]{64}"/);
  assert.doesNotMatch(first.summary.body, /What next\?|"observedReplyId"|"observedReply":/);
  const repeated = run(input({ threads: [{ ...initialThread, lastReplyId: "message-2" }], classifications: [classification("user-call", { text: "What next?" })], summaries: [summary("s1", { body: first.summary.body })] }));
  assert.deepEqual(repeated.threads, []);
  assert.equal(repeated.pending[0].kind, "user-call");
  assert.doesNotMatch(repeated.summary.body, /"kind":"decided"/);
});

test("editing a message under the same reply ID invalidates an old decision", (t) => {
  const run = runner(t);
  const initialThread = thread("t1", { lastReply: posted("What next?", "user-call"), lastReplyId: "message-1" });
  const first = run(input({ threads: [initialThread], decisions: [{ threadId: "t1", text: "archive", source: "chat:decision" }] }));
  const changed = input({ threads: [{ ...initialThread, lastReply: "Actually, what about the next release?" }], classifications: [classification("user-call", { text: "Keep or delete the next release?" })], summaries: [summary("s1", { body: first.summary.body })] });
  const result = run(changed);
  assert.deepEqual(result.threads, [{ threadId: "t1", reply: posted("Keep or delete the next release?", "user-call") }]);
  assert.equal(result.pending[0].kind, "user-call");
  const missing = run({ ...changed, classifications: [] });
  assert.deepEqual(missing.threads, []);
  assert.equal(missing.summary.status, "unknown");
});

test("reopened answers and fixes need reclassification, while closed history keeps its known count", (t) => {
  const run = runner(t);
  for (const kind of ["answer", "done"]) {
    const first = run(input({ threads: [thread("t1", { resolved: true, lastReply: "Old reply.", lastReplyId: "old" })], classifications: [classification(kind, { source: kind === "done" ? "abcdef012345" : "src/code.js" })] }));
    const request = input({ threads: [thread("t1", { lastReply: "A new question.", lastReplyId: "new" })], classifications: [], summaries: [summary("s1", { body: first.summary.body })] });
    const reopened = run(request);
    assert.deepEqual(reopened.threads, []);
    assert.equal(reopened.summary.status, "unknown");
    assert.deepEqual(reopened.unknown, ["t1"]);
    const closed = run({ ...request, threads: [{ ...request.threads[0], resolved: true }] });
    assert.deepEqual(closed.threads, []);
    assert.deepEqual(closed.unknown, []);
    assert.equal(closed.summary.status, "ready");
    assert.match(closed.summary.body, kind === "done" ? /Done: 1/ : /Answered: 1/);
  }
});

test("a reply already posted is not duplicated when only resolution remains", (t) => {
  const run = runner(t);
  const request = input();
  const first = run(request);
  const again = run({ ...request, threads: [thread("t1", { lastReply: first.threads[0].reply })] });
  assert.deepEqual(again.threads, [{ threadId: "t1", resolve: true }]);
});

test("a waiting question is skipped and keeps all options in the handover and summary", (t) => {
  const run = runner(t);
  const question = "Choose retain, archive or delete?";
  const request = input({ classifications: [classification("user-call", { text: question })] });
  const first = run(request);
  assert.equal(first.threads[0].reply, posted(question, "user-call"));
  assert.match(first.summary.body, /retain, archive or delete/);
  const again = run({ ...request, threads: [thread("t1", { lastReply: first.threads[0].reply })] });
  assert.deepEqual(again.threads, []);
  assert.equal(again.pending[0].text, question);
  assert.equal(again.pending[0].url, thread().url);
});

test("a waiting thread is recognized by its hidden kind, whatever the visible wording or language", (t) => {
  const run = runner(t);
  const asked = thread("t1", { lastReply: posted("Conserver, archiver ou supprimer ? Réponds ici.", "user-call") });
  assert.deepEqual(run(input({ threads: [asked], classifications: [classification("user-call", { text: "Garder ou supprimer ?" })] })).threads, []);
  assert.equal(run(input({ threads: [asked] })).code, 1);
  const pending = thread("t1", { lastReply: posted("Reste à faire : renommer le titre.", "todo") });
  assert.equal(run(input({ threads: [pending] })).code, 1);
  const visibleOnly = thread("t1", { lastReply: "Is the user-call todo settled? Answer here. To do." });
  assert.deepEqual(run(input({ threads: [visibleOnly] })).threads, [{ threadId: "t1", reply: posted("The code explains this. (src/code.js)", "answer"), resolve: true }]);
});

test("an open question gets no fabricated options", (t) => {
  const result = runner(t)(input({ classifications: [classification("user-call", { text: "What should happen?" })] }));
  assert.equal(result.threads[0].reply, posted("What should happen?", "user-call"));
});

test("todo waits without a commit and remains todo after an unrelated commit", (t) => {
  const run = runner(t);
  const request = input({ threads: [thread("t1", { lastReply: posted("Change the name.", "todo") })], classifications: [classification("todo", { text: "Change the name." })] });
  assert.deepEqual(run(request).threads, []);
  const afterCommit = run({ ...request, threads: [thread("t1", { lastReply: posted("Change the name.", "todo"), newCommit: true })] });
  assert.deepEqual(afterCommit.threads, []);
  assert.equal(afterCommit.pending[0].kind, "todo");
  assert.match(afterCommit.summary.body, /### To do/);
});

test("typed history preserves counts and learnings on an empty rerun without double counting", (t) => {
  const run = runner(t);
  const request = input({ threads: [thread("t1", { resolved: true }), thread("t2", { resolved: true }), thread("t3", { resolved: true })], classifications: [classification("done", { source: "abcdef012345" }), classification("done", { threadId: "t2", source: "1234567abcd" }), classification("answer", { threadId: "t3" })], learnings: [{ text: "L", url: "https://example.com/t1" }] });
  const first = run(request);
  assert.match(first.summary.body, /Done: 2 \(abcdef012, 1234567ab\)\. Answered: 1\./);
  const again = run(input({ threads: [], classifications: [], summaries: [summary("s1", { body: first.summary.body })] }));
  assert.equal(again.summary.operation, "unchanged");
  assert.match(again.summary.body, /- L \(\[thread\]/);
  const deduped = run({ ...request, classifications: [...request.classifications, request.classifications[0]] });
  assert.equal(deduped.summary.body, first.summary.body);
});

test("unknown historical classifications prevent publication without blocking known replies or handover", (t) => {
  const result = runner(t)(input({ threads: [thread(), thread("t2", { resolved: true }), thread("t3")], classifications: [classification(), classification("todo", { threadId: "t3", text: "Fix it." })] }));
  assert.equal(result.summary.status, "unknown");
  assert.equal(result.summary.body, undefined);
  assert.deepEqual(result.unknown, ["t2"]);
  assert.equal(result.threads.length, 2);
  assert.equal(result.pending[0].threadId, "t3");
});

test("a resolved thread this account never replied in is out of scope, uncounted and never blocks the summary", (t) => {
  const result = runner(t)(input({ threads: [thread(), thread("t2", { resolved: true, replyAuthors: [] }), thread("t3", { resolved: true, replyAuthors: ["someone"] })] }));
  assert.equal(result.code, 0);
  assert.deepEqual(result.unknown, []);
  assert.equal(result.summary.status, "ready");
  assert.match(result.summary.body, /Done: 0\. Answered: 1\./);
  assert.doesNotMatch(result.summary.body, /"threadId":"t[23]"/);
});

test("classifying a resolved thread this account never replied in is refused", (t) => {
  const result = runner(t)(input({ threads: [thread(), thread("t2", { resolved: true, replyAuthors: [] })], classifications: [classification(), classification("answer", { threadId: "t2" })] }));
  assert.equal(result.code, 1);
  assert.match(result.error, /t2/);
});

test("a reply text ending in a parenthesis is refused, since the script appends the source", (t) => {
  const run = runner(t);
  for (const text of ["60 seconds (line 7).", "Owner set to QA (abcdef0)"]) {
    const result = run(input({ classifications: [classification("answer", { text })] }));
    assert.equal(result.code, 1, text);
    assert.match(result.error, /source/);
  }
});

test("native resolution and old prose totals cannot invent a classification", (t) => {
  const result = runner(t)(input({ threads: [thread("t1", { resolved: true })], classifications: [], summaries: [summary("s1", { body: `${MARKER}\nDone: 9. Answered: 8.` })] }));
  assert.equal(result.summary.status, "unknown");
  assert.deepEqual(result.unknown, ["t1"]);
});

test("a summary stays unchanged after GitHub strips its terminal newline", (t) => {
  const run = runner(t);
  const request = input({ threads: [thread("t1", { resolved: true })] });
  const first = run(request);
  const stored = first.summary.body.replace(/\n$/, "");
  const again = run({ ...request, summaries: [summary("s1", { body: stored })] });
  assert.equal(again.summary.operation, "unchanged");
});

test("a marked summary belonging to someone else cannot be selected or edited", (t) => {
  const run = runner(t);
  const request = input({ summaries: [summary("other", { author: "someone-else" })] });
  assert.equal(run(request).summary.operation, "create");
  const refused = run({ ...request, summaryChoice: "other" });
  assert.equal(refused.code, 1);
  assert.match(refused.error, /owned by the current account/);
});

test("one marked current summary is updated, multiple require selection and cannot be bypassed with new", (t) => {
  const run = runner(t);
  assert.equal(run(input({ summaries: [summary()] })).summary.targetId, "s1");
  const request = input({ summaries: [summary(), summary("s2")] });
  const waiting = run(request);
  assert.equal(waiting.summary.status, "needs-choice");
  assert.deepEqual(waiting.summary.candidates, ["s1", "s2"]);
  assert.equal(waiting.summary.body, undefined);
  assert.equal(waiting.threads.length, 1);
  assert.equal(run({ ...request, summaryChoice: "s2" }).summary.targetId, "s2");
  assert.equal(run({ ...request, summaryChoice: "new" }).code, 1);
});

test("legacy adoption updates that comment and an explicit new choice creates instead", (t) => {
  const run = runner(t);
  const request = input({ summaries: [summary("legacy", { body: "## Review comments\nOld text." })] });
  const waiting = run(request);
  assert.equal(waiting.summary.status, "needs-choice");
  assert.equal(waiting.summary.allowNew, true);
  assert.equal(run({ ...request, summaryChoice: "legacy" }).summary.targetId, "legacy");
  assert.equal(run({ ...request, summaryChoice: "new" }).summary.operation, "create");
});

test("invalid ids, conflicting entries, source-free answers and malformed prior state are refused", (t) => {
  const run = runner(t);
  const invalid = [
    input({ classifications: [classification("answer", { threadId: "absent" })] }),
    input({ decisions: [{ threadId: "absent", text: "archive", source: "chat:1" }] }),
    input({ classifications: [classification(), classification("todo")] }),
    input({ classifications: [classification("answer", { source: "" })] }),
    input({ classifications: [classification("done", { source: "not-a-sha" })] }),
    input({ threads: [thread("t1", { replyAuthors: undefined })] }),
    input({ threads: [thread("t1", { replyAuthors: [""] })] }),
    input({ summaries: [summary("s1", { body: `${MARKER}\n<!-- aidd-answer-comments-state {invalid} -->` })] }),
    input({ summaries: [summary("s1", { body: `${MARKER}\n<!-- aidd-answer-comments-state {"version":99} -->` })] }),
  ];
  for (const request of invalid) assert.equal(run(request).code, 1, JSON.stringify(request));
});
