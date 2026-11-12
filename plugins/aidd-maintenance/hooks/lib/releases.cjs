'use strict';
const { semver, releaseTag, compare } = require('./versions.cjs');
const OFFICIAL_REPO = 'ai-driven-dev/framework';

function clean(value) {
  return typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]+/g, ' ').trim().slice(0, 180) : '';
}

async function request(fetcher, url, signal) {
  const response = await fetcher(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'aidd-maintenance' }, signal });
  if (!response.ok) throw new Error('Release unavailable');
  return response.json();
}

async function releaseTitle(fetcher, repo, tag) {
  const encodedRepo = repo.split('/').map(encodeURIComponent).join('/');
  const video = await request(fetcher, `https://github.com/${encodedRepo}/releases/download/${encodeURIComponent(tag)}/release-video.json`, AbortSignal.timeout(1500));
  const title = clean(video.title);
  if (!title) throw new Error('Release title unavailable');
  return title;
}

async function latestRelease(fetcher, repo, channel) {
  const encodedRepo = repo.split('/').map(encodeURIComponent).join('/');
  const signal = AbortSignal.timeout(3000);
  let selected;
  // Component releases can hide the marketplace release; keep walking while a page is full.
  for (let page = 1; page <= 5; page++) {
    const releases = await request(fetcher, `https://api.github.com/repos/${encodedRepo}/releases?per_page=100&page=${page}`, signal);
    if (!Array.isArray(releases)) throw new Error('Invalid releases');
    for (const release of releases) {
      const parsed = releaseTag(release.tag_name);
      if (!parsed || release.draft) continue;
      const releaseChannel = parsed.prerelease[0] || '';
      if (releaseChannel !== channel || (!channel && release.prerelease)) continue;
      if (!selected || compare(parsed, selected.parsed) > 0) selected = { release, parsed };
    }
    if (releases.length < 100) break;
  }
  if (!selected) throw new Error('No matching marketplace release');
  const release = selected.release;
  let title = clean(release.name) || release.tag_name;
  let titlePending = false;
  if (Array.isArray(release.assets) && release.assets.some(asset => asset.name === 'release-video.json')) {
    try {
      title = await releaseTitle(fetcher, repo, release.tag_name);
    } catch { titlePending = true; }
  }
  return { tag: release.tag_name, title, titlePending };
}

// Release Please records all plugin versions in one file at the root release tag. It is useful
// only when its root version agrees with that tag; otherwise the target versions are unknown.
async function releasePluginVersions(fetcher, repo, tag) {
  if (repo !== OFFICIAL_REPO) return null;
  try {
    const url = `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(tag)}/.release-please-manifest.json`;
    const data = await request(fetcher, url, AbortSignal.timeout(1500));
    if (!data || !semver(data['.']) || compare(semver(data['.']), releaseTag(tag)) !== 0) return null;
    const versions = {};
    for (const [key, value] of Object.entries(data)) {
      if (/^plugins\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) && semver(value)) versions[key.slice(8)] = value;
    }
    return versions;
  } catch { return null; }
}


module.exports = {clean,request,releaseTitle,latestRelease,releasePluginVersions};
