'use strict';

function semver(value) {
  if (typeof value !== 'string') return null;
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
  if (!match) return null;
  return { numbers: match.slice(1, 4).map(Number), prerelease: match[4]?.split('.') ?? [] };
}

function releaseTag(value) {
  return typeof value === 'string' && value.startsWith('v') ? semver(value) : null;
}

function compare(left, right) {
  for (let i = 0; i < 3; i++) {
    if (left.numbers[i] !== right.numbers[i]) return left.numbers[i] - right.numbers[i];
  }
  if (!left.prerelease.length) return right.prerelease.length ? 1 : 0;
  if (!right.prerelease.length) return -1;
  for (let i = 0; i < Math.max(left.prerelease.length, right.prerelease.length); i++) {
    const a = left.prerelease[i]; const b = right.prerelease[i];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a === b) continue;
    const an = /^\d+$/.test(a); const bn = /^\d+$/.test(b);
    if (an && bn) return Number(a) - Number(b);
    if (an !== bn) return an ? -1 : 1;
    return a < b ? -1 : 1;
  }
  return 0;
}


module.exports = { semver, releaseTag, compare };
