import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { latestReviewState } from './opencode-review-state.mjs';

const REVIEWER_ID = 8973343;
const ACTIONS_BOT_ID = 41898282;
const FAILURE_MARKER = /^<!-- aidd-opencode-review-failure:v1 ([1-9][0-9]*) -->$/;
const MAX_MATRIX = 256;
const SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const ISO_SECOND = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const SUBMITTED = new Set(['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED']);

function invalid(message) { throw new Error(`Review discovery: ${message}`); }
function timestamp(value, name) {
  if (typeof value !== 'string' || !ISO_SECOND.test(value)) invalid(`${name} must be an ISO UTC timestamp with seconds`);
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString().replace('.000Z', 'Z') !== value) invalid(`invalid ${name}`);
  return millis;
}
function repositoryName(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)) invalid('invalid repository');
  return name;
}
function prMetadata(pr, repository) {
  if (!pr || typeof pr !== 'object' || pr.state !== 'open' || !Number.isSafeInteger(pr.number) || pr.number < 1 ||
      typeof pr.head?.sha !== 'string' || !SHA.test(pr.head.sha) ||
      typeof pr.base?.sha !== 'string' || !SHA.test(pr.base.sha)) invalid('invalid open pull request');
  // A deleted source repo and a fork cannot be safely treated as the base repo.
  return pr.head.repo?.full_name === repository;
}

/** Select the most recent submitted, non-dismissed review by Alex for this exact head. */
export function selectReview(pr, reviews, { repository, enabledAt }) {
  const cutoff = timestamp(enabledAt, 'OPENCODE_REVIEW_ENABLED_AT');
  repositoryName(repository);
  if (!prMetadata(pr, repository)) return null;
  if (!Array.isArray(reviews)) invalid('reviews must be an array');
  const eligible = [];
  for (const review of reviews) {
    if (review?.user?.id !== REVIEWER_ID) continue;
    if (review.state === 'PENDING') continue;
    if (!(SUBMITTED.has(review.state) || review.state === 'DISMISSED') || !Number.isSafeInteger(review.id) || review.id < 1 ||
        typeof review.commit_id !== 'string' || !SHA.test(review.commit_id)) invalid(`invalid submitted review on PR #${pr.number}`);
    const when = timestamp(review.submitted_at, 'review submitted_at');
    eligible.push({ review, when });
  }
  eligible.sort((a, b) => b.when - a.when || b.review.id - a.review.id);
  const latest = eligible[0];
  if (!latest || !SUBMITTED.has(latest.review.state) || latest.when < cutoff || latest.review.commit_id !== pr.head.sha) return null;
  return { number: pr.number, reviewId: latest.review.id, head: pr.head.sha, base: pr.base.sha };
}

function pages(endpoint) {
  const raw = execFileSync('gh', ['api', endpoint, '--paginate', '--slurp'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const result = JSON.parse(raw);
  if (!Array.isArray(result) || result.some((page) => !Array.isArray(page))) invalid('unexpected GitHub pagination response');
  return result.flat();
}

export function hasReviewFailure(comments, reviewId) {
  return comments.some((comment) => {
    if (comment?.user?.id !== ACTIONS_BOT_ID || typeof comment.body !== 'string') return false;
    const trailer = comment.body.trimEnd().split(/\r?\n/).at(-1);
    return FAILURE_MARKER.exec(trailer)?.[1] === String(reviewId);
  });
}

function graph(query) {
  const result = JSON.parse(execFileSync('gh', ['api', 'graphql', '-f', `query=${query}`], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }));
  if (!result || result.errors?.length || !result.data?.repository) invalid('unexpected GitHub GraphQL response');
  return result.data.repository;
}

function graphReview(review) {
  if (!review || typeof review !== 'object') invalid('invalid GraphQL review');
  return {
    id: review.databaseId,
    state: review.state,
    submitted_at: review.submittedAt,
    commit_id: review.commit?.oid,
    user: { id: review.author?.databaseId },
  };
}
function graphComment(comment) {
  if (!comment || typeof comment !== 'object') invalid('invalid GraphQL comment');
  return {
    id: comment.databaseId,
    body: comment.body,
    created_at: comment.createdAt,
    user: { id: comment.author?.databaseId },
  };
}
function graphConnection(connection, name) {
  if (!connection || !Array.isArray(connection.nodes) || typeof connection.pageInfo?.hasPreviousPage !== 'boolean') {
    invalid(`invalid GraphQL ${name} connection`);
  }
  return connection;
}
function reviewedOrFailed(comments, reviewId) {
  const previous = latestReviewState(comments);
  return hasReviewFailure(comments, reviewId) || previous?.reviewId === String(reviewId);
}

// Group the common case into two GraphQL calls. REST is the authoritative fallback when
// a review or comment connection has more entries than the bounded GraphQL window.
function discoverGraph({ repository, enabledAt, queryPages, queryGraph }) {
  const [owner, name] = repository.split('/');
  const preliminaries = [];
  const numbers = new Set();
  const cursors = new Set();
  let cursor = null;
  for (;;) {
    const after = cursor === null ? 'null' : JSON.stringify(cursor);
    const query = `query { repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(name)}) {
      pullRequests(first:100,states:OPEN,after:${after}) {
        pageInfo { hasNextPage endCursor }
        nodes { number state headRefOid baseRefOid headRepository { nameWithOwner }
          reviews(last:20) { pageInfo { hasPreviousPage } nodes {
            databaseId state submittedAt commit { oid }
            author { __typename ... on User { databaseId } ... on Bot { databaseId } }
          } }
        }
      }
    } }`;
    const data = queryGraph(query);
    const connection = data?.pullRequests;
    if (!connection || !Array.isArray(connection.nodes) || typeof connection.pageInfo?.hasNextPage !== 'boolean') invalid('invalid GraphQL pull request connection');
    for (const node of connection.nodes) {
      if (!node || node.state !== 'OPEN') invalid('invalid GraphQL pull request');
      const pr = {
        number: node.number, state: 'open',
        head: { sha: node.headRefOid, repo: node.headRepository ? { full_name: node.headRepository.nameWithOwner } : null },
        base: { sha: node.baseRefOid },
      };
      const inRepository = prMetadata(pr, repository);
      if (numbers.has(pr.number)) invalid('duplicate pull request');
      numbers.add(pr.number);
      if (!inRepository) continue;
      const reviewsConnection = graphConnection(node.reviews, 'reviews');
      const reviews = reviewsConnection.pageInfo.hasPreviousPage
        ? queryPages(`repos/${repository}/pulls/${pr.number}/reviews?per_page=100`)
        : reviewsConnection.nodes.map(graphReview);
      const candidate = selectReview(pr, reviews, { repository, enabledAt });
      if (candidate) preliminaries.push(candidate);
    }
    if (!connection.pageInfo.hasNextPage) break;
    const next = connection.pageInfo.endCursor;
    if (typeof next !== 'string' || !next || cursors.has(next)) invalid('invalid GraphQL pull request cursor');
    cursors.add(next);
    cursor = next;
  }
  const candidates = [];
  for (let i = 0; i < preliminaries.length; i += 20) {
    const batch = preliminaries.slice(i, i + 20);
    const fields = batch.map((candidate, index) => `p${index}: pullRequest(number:${candidate.number}) {
      number comments(last:20) { pageInfo { hasPreviousPage } nodes {
        databaseId body createdAt author { __typename ... on User { databaseId } ... on Bot { databaseId } }
      } }
    }`).join('\n');
    const data = queryGraph(`query { repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(name)}) { ${fields} } }`);
    for (const [index, candidate] of batch.entries()) {
      const node = data?.[`p${index}`];
      if (!node || node.number !== candidate.number) invalid('invalid GraphQL pull request comments');
      const commentsConnection = graphConnection(node.comments, 'comments');
      const recent = commentsConnection.nodes.map(graphComment);
      const comments = commentsConnection.pageInfo.hasPreviousPage
        ? queryPages(`repos/${repository}/issues/${candidate.number}/comments?per_page=100`)
        : recent;
      if (!reviewedOrFailed(comments, candidate.reviewId)) candidates.push(candidate);
    }
  }
  if (candidates.length > MAX_MATRIX) invalid(`more than ${MAX_MATRIX} eligible pull requests`);
  return candidates;
}

/** Query only GitHub API data and emit a bounded Actions matrix. */
export function discover({ repository, enabledAt, queryPages = pages, queryGraph }) {
  repositoryName(repository);
  timestamp(enabledAt, 'OPENCODE_REVIEW_ENABLED_AT');
  if (queryGraph || queryPages === pages) return discoverGraph({ repository, enabledAt, queryPages, queryGraph: queryGraph ?? graph });
  const prs = queryPages(`repos/${repository}/pulls?state=open&per_page=100`);
  if (!Array.isArray(prs)) invalid('pull requests must be an array');
  const numbers = new Set();
  const candidates = [];
  for (const pr of prs) {
    const inRepository = prMetadata(pr, repository);
    if (numbers.has(pr.number)) invalid('duplicate pull request');
    numbers.add(pr.number);
    if (!inRepository) continue;
    const reviews = queryPages(`repos/${repository}/pulls/${pr.number}/reviews?per_page=100`);
    const candidate = selectReview(pr, reviews, { repository, enabledAt });
    if (!candidate) continue;
    const comments = queryPages(`repos/${repository}/issues/${pr.number}/comments?per_page=100`);
    if (!reviewedOrFailed(comments, candidate.reviewId)) candidates.push(candidate);
  }
  if (candidates.length > MAX_MATRIX) invalid(`more than ${MAX_MATRIX} eligible pull requests`);
  return candidates;
}

function main() {
  const candidates = discover({ repository: process.env.GITHUB_REPOSITORY, enabledAt: process.env.OPENCODE_REVIEW_ENABLED_AT });
  if (!process.env.GITHUB_OUTPUT) invalid('GITHUB_OUTPUT is required');
  appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify({ include: candidates })}\nhas_candidates=${candidates.length > 0}\n`);
  console.log(`Found ${candidates.length} eligible pull request(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
