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

const USAGE = "Usage: publish-marketplace.cjs tag <tool> <vMAJOR.MINOR.PATCH> <catalog-directory> [git-repository]\n       publish-marketplace.cjs advance <tool> <vMAJOR.MINOR.PATCH> [git-repository]";

/** Runs `work` in a scratch repository whose origin is `repository`, with its branches and release tags fetched. */
function inScratchRepository(repository, tool, work) {
  const worktree = mkdtempSync(join(tmpdir(), "aidd-marketplace-"));
  const git = (...args) => execFileSync("git", args, { cwd: worktree, encoding: "utf8" }).trim();
  try {
    git("init", "--quiet");
    git("remote", "add", "origin", repository);
    git("fetch", "--quiet", "--no-tags", "origin", `+refs/heads/*:refs/remotes/origin/*`, `refs/tags/${tool}-v*:refs/tags/${tool}-v*`);
    return work(worktree, git);
  } finally {
    rmSync(worktree, { recursive: true, force: true });
  }
}

/** The stable branch's tip and the version it carries, or none before the first release. */
function stableTip(git, tool) {
  const stable = `refs/remotes/origin/${tool}`;
  const tip = git("for-each-ref", "--format=%(objectname)", stable);
  const version = tip && git("tag", "--points-at", stable, "--list", `${tool}-v*`).replace(`${tool}-`, "");
  if (tip && !releaseTag.test(version)) throw new Error(`Unexpected history on ${tool}`);
  return { tip, version };
}

/** Pushes the immutable version tag only: the stable branch is left where it is. */
function tag(tool, version, source, repository) {
  const target = toolOf(tool);
  if (!target || !releaseTag.test(version) || !source) throw new Error(USAGE);
  inScratchRepository(repository, tool, (worktree, git) => {
    cpSync(resolve(source), worktree, { recursive: true, verbatimSymlinks: true });
    const catalogPath = join(worktree, target.catalog);
    const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
    if (!catalog.name || !catalog.plugins?.length) throw new Error(`Invalid catalog at ${target.catalog}`);
    if (catalog.name !== distribution.catalogName) {
      catalog.name = distribution.catalogName;
      writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    }

    git("add", "--all", "--force");
    const tree = git("write-tree");
    const versionRef = `refs/tags/${tool}-${version}`;
    if (git("for-each-ref", "--format=%(objectname)", versionRef)) {
      if (git("rev-parse", `${versionRef}^{tree}`) !== tree) throw new Error(`${versionRef} already points to different content`);
      console.log(`${tool} ${version} is already tagged`);
      return;
    }

    const previous = stableTip(git, tool);
    const advances = !previous.tip || compareVersions(version, previous.version) > 0;
    const commit = git(
      "-c", "user.name=AIDD Release", "-c", "user.email=release@ai-driven-dev.fr",
      "commit-tree", tree, ...(advances && previous.tip ? ["-p", previous.tip] : []), "-m", `Publish ${tool} ${version}`,
    );
    git("push", "origin", `${commit}:${versionRef}`);
    console.log(`${tool} ${version} tagged`);
  });
}

/** Moves the stable branch to an already tagged release, only when it is newer than the one the branch serves. */
function advance(tool, version, repository) {
  if (!toolOf(tool) || !releaseTag.test(version)) throw new Error(USAGE);
  inScratchRepository(repository, tool, (_worktree, git) => {
    const versionRef = `refs/tags/${tool}-${version}`;
    const commit = git("for-each-ref", "--format=%(objectname)", versionRef);
    if (!commit) throw new Error(`${versionRef} is not tagged`);
    const previous = stableTip(git, tool);
    if (previous.tip && compareVersions(version, previous.version) <= 0) {
      console.log(`${tool} stays on ${previous.version}`);
      return;
    }
    git("push", "origin", `${commit}:refs/heads/${tool}`);
    console.log(`${tool} now serves ${version}`);
  });
}

if (require.main === module) {
  const [command, tool, version, ...rest] = process.argv.slice(2);
  try {
    if (command === "tag") tag(tool, version, rest[0], rest[1] ?? distribution.repository);
    else if (command === "advance") advance(tool, version, rest[0] ?? distribution.repository);
    else throw new Error(USAGE);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
