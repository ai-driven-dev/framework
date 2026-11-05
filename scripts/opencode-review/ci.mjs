import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { encodeReviewState, latestReviewState, planReview } from './state.mjs';
import { hasReviewFailure } from './discover.mjs';

const REVIEWER_ID = 8973343; // Alex's immutable GitHub user ID.
const MAX_DIFF_BYTES = 500_000;
const MAX_INPUT_BYTES = 40_000;
const MAX_INPUT_LINES = 1_500;
const MAX_LINE_BYTES = 1_900;
const MAX_COMMENT_BYTES = 60_000;

function fail(message) { throw new Error(message); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function api(path, ...args) {
  return JSON.parse(execFileSync('gh', ['api', path, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
}
function pages(path) {
  const result = api(path, '--paginate', '--slurp');
  if (!Array.isArray(result) || result.some((page) => !Array.isArray(page))) fail('Unexpected GitHub pagination response');
  return result.flat();
}
function input() {
  const path = process.env.REVIEW_EVENT_PATH ?? (process.env.REVIEW_NUMBER ? join(process.env.RUNNER_TEMP, 'opencode-review-event.json') : process.env.GITHUB_EVENT_PATH);
  const event = readJson(path);
  const repository = process.env.GITHUB_REPOSITORY;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '')) fail('Invalid repository');
  if (event.action !== 'submitted' || event.review?.user?.id !== REVIEWER_ID || !Number.isSafeInteger(event.review.id)) fail('Unexpected review event');
  if (event.pull_request?.head?.repo?.full_name !== repository) fail('Fork PRs are not supported');
  const number = event.pull_request.number;
  if (!Number.isSafeInteger(number) || number < 1) fail('Invalid PR number');
  return { event, repository, number, root: `repos/${repository}` };
}
function assertCurrent(ctx) {
  const pr = api(`${ctx.root}/pulls/${ctx.number}`);
  if (pr.state !== 'open' || pr.head.sha !== ctx.event.review.commit_id || pr.head.sha !== ctx.event.pull_request.head.sha || pr.base.sha !== ctx.event.pull_request.base.sha) {
    fail('PR head or base changed since the review was submitted; a new submission is required');
  }
  return pr;
}
function publishComment(ctx, body) {
  if (Buffer.byteLength(body) > MAX_COMMENT_BYTES) fail('Review comment is too large to publish safely');
  execFileSync('gh', ['api', `${ctx.root}/issues/${ctx.number}/comments`, '--method', 'POST', '--input', '-'], {
    input: JSON.stringify({ body }), encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'],
  });
}
function reviewOutput(enabled) {
  appendFileSync(process.env.GITHUB_OUTPUT, `review=${enabled}\n`);
}
function wrappedInput(file, text) {
  const token = randomUUID();
  return { file, begin: `AIDD_INPUT_BEGIN_${token}`, end: `AIDD_INPUT_END_${token}`, text };
}
function inputBytes(input) { return `${input.begin}\n${input.text}\n${input.end}\n`; }
function validateInput(text, label) {
  const lines = text.split('\n');
  if (lines.length > MAX_INPUT_LINES || Buffer.byteLength(text) > MAX_INPUT_BYTES ||
      lines.some((line) => Buffer.byteLength(line) > MAX_LINE_BYTES)) fail(`${label} cannot be read completely`);
}
/** Split on complete lines so each read fits the native tool's limits. */
export function splitDiff(text) {
  if (Buffer.byteLength(text) > MAX_DIFF_BYTES) fail('Selected diff is too large for one complete review');
  const groups = []; let lines = [], bytes = 0;
  for (const line of text.split('\n')) {
    const size = Buffer.byteLength(line) + 1;
    if (size > MAX_LINE_BYTES) fail('A diff line is too long to read completely');
    if (lines.length >= MAX_INPUT_LINES - 4 || bytes + size > MAX_INPUT_BYTES - 256) {
      groups.push(lines.join('\n')); lines = []; bytes = 0;
    }
    lines.push(line); bytes += size;
  }
  if (lines.length) groups.push(lines.join('\n'));
  return groups.map((group, index) => wrappedInput(`diff-${String(index + 1).padStart(3, '0')}.md`, group));
}

function prepare() {
  const ctx = input();
  const pr = assertCurrent(ctx);
  const files = pages(`${ctx.root}/pulls/${ctx.number}/files?per_page=100`);
  if (files.length !== pr.changed_files) fail('GitHub did not return the complete PR file list');
  const comments = pages(`${ctx.root}/issues/${ctx.number}/comments?per_page=100`);
  const previous = latestReviewState(comments);
  if (previous?.reviewId === String(ctx.event.review.id) || hasReviewFailure(comments, ctx.event.review.id)) { reviewOutput(false); return; }
  const plan = planReview(files, previous?.files ?? {});
  assertCurrent(ctx);
  if (!plan.selected.length) {
    if (previous) {
      // Advance the hidden checkpoint without publishing another visible comment. This also
      // records files removed from the PR, so reintroducing one is treated as a new diff.
      const prefix = '<!-- aidd-opencode-review-state:v1 ';
      const candidates = comments.filter((comment) => comment?.user?.id === 41898282 && typeof comment.body === 'string' && comment.body.trimEnd().split(/\r?\n/).at(-1).startsWith(prefix));
      candidates.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
      const target = candidates[0];
      if (!target) fail('Previous review comment is missing');
      const marker = encodeReviewState({ files: plan.current, head: pr.head.sha, reviewId: ctx.event.review.id });
      const body = target.body.replace(/<!-- aidd-opencode-review-state:v1 [A-Za-z0-9_-]+ -->\s*$/, marker);
      if (body === target.body || Buffer.byteLength(body) > MAX_COMMENT_BYTES) fail('Cannot update the review checkpoint safely');
      assertCurrent(ctx);
      execFileSync('gh', ['api', `${ctx.root}/issues/comments/${target.id}`, '--method', 'PATCH', '--input', '-'], {
        input: JSON.stringify({ body }), encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'],
      });
    }
    reviewOutput(false);
    return;
  }
  const diff = plan.selected.map((file) => [
    `## ${JSON.stringify(file.filename)} (${file.status})`,
    file.previous_filename ? `Previous path: ${JSON.stringify(file.previous_filename)}` : '',
    '```diff', file.patch, '```', '',
  ].filter(Boolean).join('\n')).join('\n');
  const chunks = splitDiff(diff);
  const context = wrappedInput('context.md', `Title: ${pr.title}\n\n${pr.body ?? ''}`);
  validateInput(inputBytes(context), 'PR description');
  const dir = join(process.env.RUNNER_TEMP, 'opencode-review-input');
  mkdirSync(dir, { recursive: true });
  for (const input of [...chunks, context]) writeFileSync(join(dir, input.file), inputBytes(input));
  const inputs = [...chunks, context].map(({ file, begin, end }) => ({ file, begin, end }));
  writeFileSync(join(dir, 'plan.json'), JSON.stringify({ files: plan.current, selected: plan.selected.map((file) => file.filename), inputs, head: pr.head.sha, base: pr.base.sha, reviewId: String(ctx.event.review.id) }));
  reviewOutput(true);
}
export function reportFromEvents(path, selected, inputs) {
  const events = readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  if (events.some((event) => event.type === 'error')) fail('OpenCode reported an error');
  const uses = events.filter((event) => event.type === 'tool_use').map((event) => event.part ?? {});
  if (!uses.some((part) => part.tool === 'skill' && part.state?.status === 'completed' && part.state?.input?.id === '05-review')) fail('Review skill was not loaded');
  const reads = uses.filter((part) => part.tool === 'read' && part.state?.status === 'completed');
  const snapshot = resolve(process.env.RUNNER_TEMP, 'opencode-review');
  const skill = join(snapshot, '.opencode', 'skills', '05-review');
  for (const path of ['actions/01-prepare.md', 'actions/02-review.md', 'actions/03-conclude.md',
    'references/rubric.md', 'references/axis-code.md', 'references/axis-functional.md', 'references/axis-relevancy.md',
    'assets/review-template.md'].map((part) => join(skill, part))) {
    if (!reads.some((read) => resolve(snapshot, read.state?.input?.path ?? '') === path)) fail(`Review did not read ${path}`);
  }
  if (!Array.isArray(inputs) || !inputs.some((input) => input.file === 'context.md') || !inputs.some((input) => /^diff-\d{3}\.md$/.test(input.file))) fail('Missing review inputs');
  for (const input of inputs) {
    const path = join(snapshot, '.review-input', input.file);
    if (!reads.some((read) => resolve(snapshot, read.state?.input?.path ?? '') === path &&
        typeof read.state?.output === 'string' && read.state.output.includes(input.begin) && read.state.output.includes(input.end) &&
        read.state?.metadata?.metadata?.truncated !== true)) fail(`Review did not read all of ${input.file}`);
  }
  const output = events.filter((event) => event.type === 'text').map((event) => event.part?.text).filter(Boolean).at(-1);
  if (!output || !/\b(approve|changes-requested|blocked)\b/i.test(output)) fail('OpenCode did not complete an actionable review');
  const verdictLines = [...output.matchAll(/^AIDD_REVIEW_VERDICT_V1: (approve|changes-requested|blocked)$/gm)];
  if (verdictLines.length !== 1) fail('Missing or ambiguous verdict line');
  const matches = [...output.matchAll(/^AIDD_REVIEW_COVERAGE_V1: (.+)$/gm)];
  if (matches.length !== 1) fail('OpenCode did not provide the exact coverage manifest');
  let coverage;
  try { coverage = JSON.parse(matches[0][1]); } catch { fail('Invalid coverage manifest'); }
  if (!coverage || coverage.status !== 'complete' || !['approve', 'changes-requested', 'blocked'].includes(coverage.verdict) ||
      !Array.isArray(coverage.files) || coverage.files.some((name) => typeof name !== 'string') ||
      coverage.files.length !== selected.length || new Set(coverage.files).size !== selected.length ||
      selected.some((name) => !coverage.files.includes(name))) fail('OpenCode did not cover the exact selected files');
  if (coverage.verdict === 'blocked' && (!Array.isArray(coverage.critical_findings) || !coverage.critical_findings.length ||
      coverage.critical_findings.some((finding) => !finding || !selected.includes(finding.file) ||
        !Number.isSafeInteger(finding.line) || finding.line < 1 || typeof finding.proof !== 'string' || !finding.proof.trim() ||
        typeof finding.fix !== 'string' || !finding.fix.trim()))) fail('Blocked verdict has no substantiated critical finding');
  if (verdictLines[0][1] !== coverage.verdict) fail('Report does not match its verdict');
  let report = output.replace(matches[0][0], '').replace(verdictLines[0][0], '').trim();
  if (!report) fail('OpenCode returned an empty report');
  const verdictHeadings = report.split('\n').filter((line) => /^\s*(?:[-*#>]\s*)*(?:\*\*)?verdict(?:\*\*)?\s*[:：]/i.test(line));
  for (const heading of verdictHeadings) {
    const label = heading.match(/verdict(?:\*\*)?\s*[:：]\s*[*`]*(approve|changes-requested|blocked)\b/i)?.[1]?.toLowerCase();
    if (label !== coverage.verdict) fail('Report does not match its verdict');
  }
  const lines = report.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*#{1,6}\s*(?:\*\*)?verdict(?:\*\*)?\s*[:：]?\s*$/i.test(lines[i])) continue;
    const following = lines.slice(i + 1).find((line) => line.trim());
    const label = following?.match(/^\s*[*`]*(approve|changes-requested|blocked)\b/i)?.[1]?.toLowerCase();
    if (label !== coverage.verdict) fail('Report does not match its verdict');
  }
  report += `\n\n**Verdict : ${coverage.verdict}**`;
  if (coverage.verdict === 'blocked') {
    const critical = coverage.critical_findings.map((finding) =>
      `- ${JSON.stringify(finding.file)}:${finding.line} — Preuve : ${finding.proof.trim()} ; correction : ${finding.fix.trim()}`,
    ).join('\n');
    report += `\n\n### Constats critiques indiqués par OpenCode\n\n${critical}`;
  }
  return report;
}
function publish() {
  const ctx = input();
  const dir = join(process.env.RUNNER_TEMP, 'opencode-review-input');
  const plan = readJson(join(dir, 'plan.json'));
  const pr = assertCurrent(ctx);
  if (plan.head !== pr.head.sha || plan.base !== pr.base.sha || plan.reviewId !== String(ctx.event.review.id)) fail('Prepared review no longer matches the event');
  const comments = pages(`${ctx.root}/issues/${ctx.number}/comments?per_page=100`);
  if (latestReviewState(comments)?.reviewId === plan.reviewId) return;
  const report = reportFromEvents(join(process.env.RUNNER_TEMP, 'opencode-review-events.jsonl'), plan.selected, plan.inputs);
  const marker = encodeReviewState(plan);
  assertCurrent(ctx);
  publishComment(ctx, `## Revue OpenCode\n\nCommit examiné : \`${plan.head}\`\n\n${report}\n\n${marker}`);
}

function recordFailure() {
  const repository = process.env.GITHUB_REPOSITORY;
  const number = process.env.REVIEW_NUMBER;
  const reviewId = process.env.REVIEW_ID;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '') || !/^[1-9]\d*$/.test(number ?? '') || !/^[1-9]\d*$/.test(reviewId ?? '')) fail('Invalid failed review parameters');
  const ctx = { root: `repos/${repository}`, number: Number(number) };
  const review = api(`${ctx.root}/pulls/${number}/reviews/${reviewId}`);
  if (String(review.id) !== reviewId || review.user?.id !== REVIEWER_ID || !['COMMENTED', 'APPROVED', 'CHANGES_REQUESTED'].includes(review.state)) fail('Cannot verify the failed review');
  const comments = pages(`${ctx.root}/issues/${number}/comments?per_page=100`);
  if (latestReviewState(comments)?.reviewId === reviewId) return;
  const marker = `<!-- aidd-opencode-review-failure:v1 ${reviewId} -->`;
  if (hasReviewFailure(comments, reviewId)) return;
  const server = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
  const run = process.env.GITHUB_RUN_ID ?? '';
  if (server !== 'https://github.com' || !/^[1-9]\d*$/.test(run)) fail('Cannot construct a safe Actions link');
  publishComment(ctx, `La revue OpenCode n’a pas abouti. Aucun fichier n’a été enregistré comme revu. [Voir le résultat](${server}/${repository}/actions/runs/${run}). Une nouvelle soumission de review permet de réessayer.\n\n${marker}`);
}
function loadEvent() {
  const repository = process.env.GITHUB_REPOSITORY;
  const number = process.env.REVIEW_NUMBER;
  const reviewId = process.env.REVIEW_ID;
  const cutoffText = process.env.OPENCODE_REVIEW_ENABLED_AT ?? '';
  const cutoff = Date.parse(cutoffText);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '') || !/^[1-9]\d*$/.test(number ?? '') || !/^[1-9]\d*$/.test(reviewId ?? '') || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(cutoffText) || !Number.isFinite(cutoff)) fail('Invalid scheduled review parameters');
  const root = `repos/${repository}/pulls/${number}`;
  const pr = api(root);
  const review = api(`${root}/reviews/${reviewId}`);
  if (review.user?.id !== REVIEWER_ID || !['COMMENTED', 'APPROVED', 'CHANGES_REQUESTED'].includes(review.state) || !Number.isFinite(Date.parse(review.submitted_at)) || Date.parse(review.submitted_at) < cutoff || review.commit_id !== pr.head.sha) fail('Scheduled review is not a current submission by Alex');
  if (pr.head?.repo?.full_name !== repository || pr.state !== 'open') fail('Fork or closed PRs are not supported');
  const path = process.env.REVIEW_EVENT_PATH ?? join(process.env.RUNNER_TEMP, 'opencode-review-event.json');
  writeFileSync(path, JSON.stringify({ action: 'submitted', pull_request: pr, review }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === 'event') loadEvent();
  else if (process.argv[2] === 'prepare') prepare();
  else if (process.argv[2] === 'publish') publish();
  else if (process.argv[2] === 'failure') recordFailure();
  else fail('Expected event, prepare, publish or failure');
}
