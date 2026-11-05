import { execFileSync } from 'node:child_process';

const REVIEWER_ID = 8973343;
const SUBMITTED = new Set(['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED']);

export function pages(endpoint) {
  const data = JSON.parse(execFileSync('gh', ['api', endpoint, '--paginate', '--slurp'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 60_000,
  }));
  if (!Array.isArray(data) || data.some((page) => !Array.isArray(page))) throw new Error('Unexpected GitHub pagination response');
  return data.flat();
}

export function selectReview(pr, reviews, enabledAt) {
  const cutoff = Date.parse(enabledAt);
  if (!Number.isFinite(cutoff)) throw new Error('A valid activation time is required');
  if (pr?.state !== 'open' || !Number.isSafeInteger(pr.number) || !pr.head?.sha || !pr.base?.sha) return null;
  const latest = reviews.filter((review) => review?.user?.id === REVIEWER_ID && SUBMITTED.has(review.state) &&
      Number.isSafeInteger(review.id) && Number.isFinite(Date.parse(review.submitted_at)))
    .sort((a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at) || b.id - a.id)[0];
  if (!latest || Date.parse(latest.submitted_at) < cutoff) return null;
  return { number: pr.number, reviewId: latest.id, head: pr.head.sha, base: pr.base.sha };
}

// A failure on one PR must not stop discovery of the others.
export function discover({ repository, enabledAt, authorId, store, queryPages = pages, onError = console.error }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '')) throw new Error('Invalid repository');
  if (!Number.isFinite(Date.parse(enabledAt))) throw new Error('A valid activation time is required');
  if (!Number.isSafeInteger(authorId)) throw new Error('A verified comment author is required');
  if (!store || typeof store.load !== 'function') throw new Error('A persistent state store is required');
  const candidates = [];
  for (const pr of queryPages(`repos/${repository}/pulls?state=open&per_page=100`)) {
    try {
      const review = selectReview(pr, queryPages(`repos/${repository}/pulls/${pr.number}/reviews?per_page=100`), enabledAt);
      if (!review) continue;
      const record = store.load(pr.number);
      const sameReview = record.state?.reviewId === String(review.reviewId);
      if (record.draft || !sameReview || (record.state.atomicFiles && record.state.pending)) candidates.push(review);
    } catch (error) {
      onError(`PR #${pr.number}: ${error.message}`);
    }
  }
  return candidates;
}
