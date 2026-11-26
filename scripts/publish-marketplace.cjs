const { execFileSync } = require("node:child_process");
const { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const distribution = require("./marketplace-distribution.json");
const { toolOf } = require("./marketplace-tools.cjs");

const releaseTag = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function compareVersions(left, right) {
  const a = left.match(releaseTag).slice(1).map(BigInt);
  const b = right.match(releaseTag).slice(1).map(BigInt);
  const index = a.findIndex((part, i) => part !== b[i]);
  return index === -1 ? 0 : a[index] > b[index] ? 1 : -1;
}

function publish(tool, version, source, repository) {
  const target = toolOf(tool);
  if (!target || !releaseTag.test(version) || !source) {
    throw new Error("Usage: publish-marketplace.cjs <tool> <vMAJOR.MINOR.PATCH> <catalog-directory> [git-repository]");
  }
  const worktree = mkdtempSync(join(tmpdir(), "aidd-marketplace-"));
  const git = (...args) => execFileSync("git", args, { cwd: worktree, encoding: "utf8" }).trim();
  try {
    cpSync(resolve(source), worktree, { recursive: true, verbatimSymlinks: true });
    const catalogPath = join(worktree, target.catalog);
    const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
    if (!catalog.name || !catalog.plugins?.length) throw new Error(`Invalid catalog at ${target.catalog}`);
    if (catalog.name !== distribution.catalogName) {
      catalog.name = distribution.catalogName;
      writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    }

    git("init", "--quiet");
    git("remote", "add", "origin", repository);
    git("fetch", "--quiet", "--no-tags", "origin", `+refs/heads/*:refs/remotes/origin/*`, `refs/tags/${tool}-v*:refs/tags/${tool}-v*`);
    git("add", "--all", "--force");
    const tree = git("write-tree");
    const versionRef = `refs/tags/${tool}-${version}`;
    if (git("for-each-ref", "--format=%(objectname)", versionRef)) {
      if (git("rev-parse", `${versionRef}^{tree}`) !== tree) throw new Error(`${versionRef} already points to different content`);
      console.log(`${tool} ${version} is already published`);
      return;
    }

    const stable = `refs/remotes/origin/${tool}`;
    const previous = git("for-each-ref", "--format=%(objectname)", stable);
    const previousVersion = previous && git("tag", "--points-at", stable, "--list", `${tool}-v*`).replace(`${tool}-`, "");
    if (previous && !releaseTag.test(previousVersion)) throw new Error(`Unexpected history on ${tool}`);
    const advance = !previous || compareVersions(version, previousVersion) > 0;
    const commit = git(
      "-c", "user.name=AIDD Release", "-c", "user.email=release@ai-driven-dev.fr",
      "commit-tree", tree, ...(advance && previous ? ["-p", previous] : []), "-m", `Publish ${tool} ${version}`,
    );
    const refs = [`${commit}:${versionRef}`];
    if (advance) refs.push(`${commit}:refs/heads/${tool}`);
    git("push", "--atomic", "origin", ...refs);
    console.log(`${tool} ${version} published${advance ? ` to ${tool}` : " as a version tag only"}`);
  } finally {
    rmSync(worktree, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const [tool, version, source, repository = distribution.repository] = process.argv.slice(2);
  try {
    publish(tool, version, source, repository);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
