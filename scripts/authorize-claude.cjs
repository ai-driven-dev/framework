const fs = require("node:fs");
// Verified authenticated GitHub account: alexsoyes. Numeric identity survives a rename.
const ownerId = 8973343;

// This runs from the workflow's trusted default-branch checkout, without Claude secrets.
async function authorize({ event, eventName, repository, actor, triggeringActor, request }) {
  const deny = (reason) => ({ allowed: false, reason });
  if (!["issue_comment", "pull_request_review_comment", "pull_request_review", "workflow_dispatch"].includes(eventName)) {
    return deny("Unsupported event");
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || event.repository?.full_name !== repository) {
    return deny("Repository mismatch");
  }
  if (event.sender?.type !== "User" || actor !== event.sender.login) return deny("Human sender required");
  if (![actor, triggeringActor].every((login) => typeof login === "string" && /^[A-Za-z0-9-]+$/.test(login))) {
    return deny("Invalid actor");
  }
  if (event.sender.id !== ownerId || triggeringActor !== actor) return deny("Only the subscription owner can invoke or rerun Claude");
  const body = event.comment?.body ?? event.review?.body ?? "";
  if (eventName !== "workflow_dispatch" && !/(?:^|\s)@claude(?=$|\s|[,:;.!?])/i.test(body)) {
    return deny("No Claude mention");
  }
  for (const login of new Set([actor, triggeringActor])) {
    const access = await request(`/repos/${repository}/collaborators/${login}/permission`);
    if (access.user?.id !== ownerId) return deny("GitHub account identity mismatch");
    if (!["admin", "write", "maintain"].includes(access.permission)) return deny("Repository write access required");
  }
  if (eventName === "workflow_dispatch") return { allowed: true, reason: "Authorized smoke test" };
  const number = event.issue?.number ?? event.pull_request?.number;
  if (!Number.isSafeInteger(number) || number <= 0) return deny("Invalid issue or pull request");
  const isPr = Boolean(event.issue?.pull_request || event.pull_request);
  if (isPr) {
    const pr = await request(`/repos/${repository}/pulls/${number}`);
    if (pr.state !== "open") return deny("Open pull request required");
    if (pr.head?.repo?.full_name !== repository) return deny("Fork pull requests cannot run the write-capable agent");
    if (!pr.head?.ref || ["main", "next"].includes(pr.head.ref)) return deny("Protected source branch");
  }
  return { allowed: true, reason: "Authorized repository contribution" };
}

async function main() {
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("GitHub token missing");
  const result = await authorize({
    event: JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")),
    eventName: process.env.GITHUB_EVENT_NAME,
    repository: process.env.GITHUB_REPOSITORY,
    actor: process.env.GITHUB_ACTOR,
    triggeringActor: process.env.GITHUB_TRIGGERING_ACTOR,
    request: async (path) => {
      const response = await fetch(`https://api.github.com${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`GitHub authorization check failed (${response.status})`);
      return response.json();
    },
  });
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `allowed=${result.allowed}\n`);
  console.log(result.reason);
}

module.exports = { authorize };
if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
