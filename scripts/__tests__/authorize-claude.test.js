const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const { authorize } = require("../authorize-claude.cjs");

const repository = "ai-driven-dev/framework";
function context(overrides = {}) {
  return {
    repository, actor: "maintainer", triggeringActor: "maintainer", eventName: "issue_comment",
    event: { repository: { full_name: repository }, sender: { login: "maintainer", type: "User" },
      issue: { number: 984, pull_request: {} }, comment: { body: "@claude fix the failing check", author_association: "MEMBER" } },
    request: async (url) => url.endsWith("/permission") ? { permission: "write" } :
      { state: "open", head: { repo: { full_name: repository }, ref: "feat/example" } },
    ...overrides,
  };
}

test("author association never grants write access", async () => {
  for (const permission of ["read", "triage", "none", undefined]) {
    const result = await authorize(context({ request: async () => ({ permission }) }));
    assert.equal(result.allowed, false, permission);
  }
});
test("accepts current writers on same-repository feature PRs and issues", async () => {
  for (const permission of ["write", "admin", "maintain"]) {
    const ctx = context();
    const original = ctx.request;
    ctx.request = async (url) => url.endsWith("/permission") ? { permission } : original(url);
    assert.equal((await authorize(ctx)).allowed, true);
    delete ctx.event.issue.pull_request;
    assert.equal((await authorize(ctx)).allowed, true);
  }
});
test("checks rerunner permissions as well as original sender", async () => {
  const seen = [];
  const result = await authorize(context({ triggeringActor: "outsider", request: async (url) => {
    seen.push(url); return { permission: url.includes("/outsider/") ? "read" : "write" };
  } }));
  assert.equal(result.allowed, false);
  assert.equal(seen.length, 2);
});
test("rejects forks, deleted sources, protected source branches and closed PRs", async () => {
  for (const pr of [
    { state: "open", head: { repo: { full_name: "outsider/framework" }, ref: "feature" } },
    { state: "open", head: { repo: null, ref: "feature" } },
    ...["main", "next"].map((ref) => ({ state: "open", head: { repo: { full_name: repository }, ref } })),
    { state: "closed", head: { repo: { full_name: repository }, ref: "feature" } },
  ]) {
    const result = await authorize(context({ request: async (url) => url.endsWith("/permission") ? { permission: "write" } : pr }));
    assert.equal(result.allowed, false, JSON.stringify(pr));
  }
});
test("bots, mismatched actors/repositories and non-mentions cannot reach the API", async () => {
  for (const mutate of [
    (ctx) => { ctx.event.sender.type = "Bot"; },
    (ctx) => { ctx.actor = "other"; },
    (ctx) => { ctx.repository = "other/framework"; },
    (ctx) => { ctx.eventName = "pull_request_target"; },
    ...["hello", "@claude-bot fix", "email@claude"].map((body) => (ctx) => { ctx.event.comment.body = body; }),
  ]) {
    const ctx = context({ request: () => { throw new Error("API must not be called"); } });
    mutate(ctx);
    assert.equal((await authorize(ctx)).allowed, false);
  }
});
test("supports inline and submitted reviews with live PR checks", async () => {
  for (const eventName of ["pull_request_review_comment", "pull_request_review"]) {
    const ctx = context({ eventName });
    ctx.event.pull_request = { number: 984 }; delete ctx.event.issue;
    if (eventName === "pull_request_review") { ctx.event.review = ctx.event.comment; delete ctx.event.comment; }
    assert.equal((await authorize(ctx)).allowed, true);
  }
});
test("manual smoke tests still need live write access", async () => {
  assert.equal((await authorize(context({ eventName: "workflow_dispatch" }))).allowed, true);
  assert.equal((await authorize(context({ eventName: "workflow_dispatch", request: async () => ({ permission: "read" }) }))).allowed, false);
});
test("API errors fail closed", async () => {
  await assert.rejects(authorize(context({ request: async () => { throw new Error("GitHub unavailable"); } })), /GitHub unavailable/);
});
test("Claude secrets are gated by a read-only trusted-checkout job", () => {
  const workflow = yaml.load(fs.readFileSync(path.resolve(__dirname, "../../.github/workflows/claude.yml"), "utf8"));
  assert.deepEqual(workflow.permissions, {});
  assert.deepEqual(workflow.jobs.authorize.permissions, { contents: "read" });
  assert.equal(workflow.jobs.claude.needs, "authorize");
  assert.equal(workflow.jobs.claude.if, "needs.authorize.outputs.allowed == 'true'");
  assert.doesNotMatch(JSON.stringify(workflow.jobs.authorize), /secrets\./);
  assert.equal(workflow.jobs.claude.concurrency.group, "claude-framework");
  assert.equal(workflow.jobs.claude.concurrency.queue, "max");
  for (const job of Object.values(workflow.jobs)) {
    for (const step of job.steps) {
      if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
      if (step.uses?.startsWith("actions/checkout@")) {
        assert.equal(step.with["persist-credentials"], false);
        assert.equal(step.with.ref, "${{ github.event.repository.default_branch }}");
      }
    }
  }
});
