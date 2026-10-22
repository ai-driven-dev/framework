const { execFileSync } = require("node:child_process");

const STEPS = [
  ["build-and-attach", "Marketplace bundle"],
  ["build-per-tool", "Distributions"],
  ["build-plugin", "Plugin archives"],
  ["build-release-video", "Release video"],
  ["publish-cli", "CLI on npm"],
  ["publish-release", "Publication"],
];

const nameOf = (path) => (path === "." ? "framework" : path === "cli" ? "CLI" : path.replace(/^plugins\//, ""));

/** The versions that moved since the previous release, or all of them when there is none. */
function changedVersions(current, previous) {
  return Object.entries(current)
    .filter(([path, version]) => previous[path] !== version)
    .map(([path, version]) => `${nameOf(path)} ${version}`);
}

/** The message a release leaves in Slack: whether it went out, and what ran or broke on the way. */
function recap({ tag, repo, runUrl, assets, needs, published, versions = [] }) {
  const lines = [`Release ${tag} ${published ? "published" : "NOT published, it stays a draft"}`];
  for (const [job, label] of STEPS) {
    const result = needs[job]?.result;
    if (!result || result === "skipped") continue;
    lines.push(result === "success" ? `✅ ${label}` : `❌ ${label}: ${result === "failure" ? "failed" : result}`);
  }
  if (!assets.includes("release-video.mp4")) lines.push("No release video attached.");
  if (versions.length) lines.push(`Versions: ${versions.join(" · ")}`);
  lines.push(`Release: https://github.com/${repo}/releases/tag/${tag}`, `Run: ${runUrl}`);
  return lines.join("\n");
}

function readManifest(ref) {
  return JSON.parse(execFileSync("git", ["show", `${ref}:.release-please-manifest.json`], { encoding: "utf8" }));
}

/** The manifest of the release before this one, empty when there is none to compare with. */
function previousManifest(tag) {
  try {
    const previous = execFileSync("git", ["describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", `${tag}^`], { encoding: "utf8" }).trim();
    return readManifest(previous);
  } catch {
    return {};
  }
}

async function main() {
  const { NEEDS, TAG, REPO, RUN_URL } = process.env;
  const needs = JSON.parse(NEEDS);
  const assets = JSON.parse(
    execFileSync("gh", ["release", "view", TAG, "--repo", REPO, "--json", "assets", "--jq", "[.assets[].name]"], {
      encoding: "utf8",
    }),
  );
  const text = recap({
    tag: TAG,
    repo: REPO,
    runUrl: RUN_URL,
    assets,
    needs,
    published: needs["publish-release"]?.result === "success",
    versions: changedVersions(readManifest("HEAD"), previousManifest(TAG)),
  });
  console.log(text);
}

module.exports = { recap, changedVersions };

if (require.main === module) {
  main().catch((error) => console.log(`Recap not printed: ${error.message}`));
}
