#!/usr/bin/env node
/**
 * Appends each release line's contributors as `(@login, ...)`, or the name when no account, to the
 * GitHub releases release-please just created: the commit author, its human co-authors, and the
 * authors of the pull requests its own pull request supersedes. Also drops a merge commit's
 * duplicate line (see credit()).
 *
 * release-please's `include-commit-authors` is a no-op (googleapis/release-please#2761).
 */

const { execFileSync } = require("node:child_process");

// Every entry links its full commit SHA: `([7fbe889](https://…/commit/<40 hex>))`.
const COMMIT_SHA = /\/commit\/([0-9a-f]{40})\)/;

// The commit link; the text before it is the bullet itself.
const COMMIT_LINK = /\s\(\[[0-9a-f]+\]\(https:\/\/[^\s)]+\/commit\/[0-9a-f]{40}\)\)/;

// Matched only after the commit link: a credit this script appended. Keeps re-runs a no-op.
const ALREADY_CREDITED = /\s\(/;

/** The bullet's text before its commit link. */
function bulletText(line) {
  const link = line.match(COMMIT_LINK);
  return link ? line.slice(0, link.index) : line;
}

/**
 * Credits each commit-linked line. A merge-commit line with a plain-commit twin is dropped (the
 * repo puts the PR title in a merge commit's body, which release-please parses as a 2nd commit);
 * a lone one is credited to its PR's author. `resolve(sha)` returns `{ who, isMerge, prAuthor }`.
 */
function credit(body, resolve) {
  const lines = body.split("\n");

  const items = lines.map((line) => {
    const match = line.match(COMMIT_SHA);
    if (!match) return { line, sha: null };
    return { line, sha: match[1], match, text: bulletText(line) };
  });

  for (const item of items) {
    if (item.sha) item.meta = resolve(item.sha) || {};
  }

  const groups = new Map();
  for (const item of items) {
    if (!item.sha) continue;
    if (!groups.has(item.text)) groups.set(item.text, []);
    groups.get(item.text).push(item);
  }

  const drop = new Set();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const hasPlainCommitTwin = group.some((item) => !item.meta.isMerge);
    if (!hasPlainCommitTwin) continue; // an all-merge twin group: nothing tells them apart
    for (const item of group) {
      if (item.meta.isMerge) drop.add(item);
    }
  }

  return items
    .filter((item) => !drop.has(item))
    .map((item) => {
      if (!item.sha) return item.line;

      const tail = item.line.slice(item.match.index + item.match[0].length);
      if (ALREADY_CREDITED.test(tail)) return item.line;

      const author = item.meta.isMerge ? item.meta.prAuthor || item.meta.who : item.meta.who;
      const credits = [...new Set([author, ...(item.meta.also || [])].filter(Boolean))];
      return credits.length ? `${item.line} (${credits.join(", ")})` : item.line;
    })
    .join("\n");
}

/** Tags created this run: root as `tag_name`, other paths as `<path>--tag_name`. */
function tagsFromOutputs(outputs) {
  const paths = JSON.parse(outputs.paths_released || "[]");
  return paths.map((releasedPath) => (releasedPath === "." ? outputs.tag_name : outputs[`${releasedPath}--tag_name`])).filter(Boolean);
}

/** Thin `gh` wrapper so the transform above stays network-free and unit-testable. */
function gh(...args) {
  return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

/** `@login`, or the author's name when the commit has no linked account. */
function who(apiReply) {
  const { login, name } = JSON.parse(apiReply);
  return login ? `@${login}` : name;
}

/** More than one parent: a merge commit. */
function isMerge(apiReply) {
  const { parents } = JSON.parse(apiReply);
  return Number(parents) > 1;
}

/** A merge commit's credit: its PR author, else the commit author. */
function prCredit(commitReply, pr) {
  const login = pr && pr.user && pr.user.login;
  return login ? `@${login}` : who(commitReply);
}

/** The pull request that merged `sha`; the pulls reply also lists others that contain it. */
function pullRequestOf(sha, pullsReply) {
  return JSON.parse(pullsReply).find((pr) => pr.merge_commit_sha === sha);
}

const isBot = (login) => login.endsWith("[bot]");

const CO_AUTHOR = /^co-authored-by:\s*(.+?)\s*<([^>]*)>\s*$/gim;
const NOREPLY_LOGIN = /^\d+\+([^@]+)@users\.noreply\.github\.com$/i;
const CLAUDE_EMAIL = "noreply@anthropic.com";

/** The human `Co-authored-by` trailers of a commit message: `@login` from a GitHub noreply address, else the name. */
function coAuthors(message) {
  const credits = [];
  for (const [, name, email] of message.matchAll(CO_AUTHOR)) {
    if (email.toLowerCase() === CLAUDE_EMAIL) continue;
    const login = email.match(NOREPLY_LOGIN);
    if (login && isBot(login[1])) continue;
    credits.push(login ? `@${login[1]}` : name);
  }
  return credits;
}

// `Supersedes #992`, or a list: `Supersedes #1356, #1361 and #1354`.
const SUPERSEDES = /\bSupersedes\s+(#\d+(?:(?:\s*,\s*|\s+and\s+)#\d+)*)/g;

/** The authors of the pull requests a PR body supersedes, bots left out. `authorOf(number)` returns a login. */
function takenOver(body, authorOf) {
  const numbers = [...body.matchAll(SUPERSEDES)].flatMap((match) => match[1].match(/\d+/g));
  return numbers
    .map(authorOf)
    .filter((login) => login && !isBot(login))
    .map((login) => `@${login}`);
}

function resolverFor(repo) {
  const cache = new Map();
  const authors = new Map();
  const authorOf = (number) => {
    if (!authors.has(number)) authors.set(number, gh("api", `repos/${repo}/pulls/${number}`, "-q", ".user.login"));
    return authors.get(number);
  };
  return (sha) => {
    if (!cache.has(sha)) {
      const commitReply = gh("api", `repos/${repo}/commits/${sha}`, "-q", '{login: (.author.login // ""), name: .commit.author.name, parents: (.parents | length), message: .commit.message}');
      const merge = isMerge(commitReply);
      const pr = pullRequestOf(sha, gh("api", `repos/${repo}/commits/${sha}/pulls`));
      cache.set(sha, {
        who: who(commitReply),
        isMerge: merge,
        prAuthor: merge ? prCredit(commitReply, pr) : "",
        also: [...coAuthors(JSON.parse(commitReply).message), ...takenOver((pr && pr.body) || "", authorOf)],
      });
    }
    return cache.get(sha);
  };
}

/** Credits each tag; writes only changed bodies, and throws naming the tag on failure. */
function creditReleases(repo, outputs, { read, resolve, write }) {
  const tags = tagsFromOutputs(outputs);

  for (const tag of tags) {
    let body;
    try {
      body = read(tag);
    } catch (error) {
      throw new Error(`credit-release-authors: could not read release ${tag}: ${error.message}`);
    }

    let credited;
    try {
      credited = credit(body, resolve);
    } catch (error) {
      throw new Error(`credit-release-authors: could not resolve a commit author for release ${tag}: ${error.message}`);
    }
    if (credited === body) {
      console.log(`${tag}: unchanged`);
      continue;
    }

    try {
      write(tag, credited);
    } catch (error) {
      throw new Error(`credit-release-authors: could not write release ${tag}: ${error.message}`);
    }
    console.log(`${tag}: credited`);
  }
}

/** Wires `creditReleases` to the real `gh` CLI. The one place this module touches the network. */
function main(repo, outputs) {
  creditReleases(repo, outputs, {
    read: (tag) => gh("release", "view", tag, "-R", repo, "--json", "body", "-q", ".body"),
    resolve: resolverFor(repo),
    write: (tag, body) => execFileSync("gh", ["release", "edit", tag, "-R", repo, "--notes-file", "-"], { input: body, encoding: "utf8" }),
  });
}

module.exports = { credit, tagsFromOutputs, who, isMerge, prCredit, pullRequestOf, coAuthors, takenOver, resolverFor, creditReleases };

if (require.main === module) {
  const repo = process.argv[2];
  if (!repo) {
    console.error("usage: credit-release-authors.cjs <owner/repo>  (reads RELEASE_OUTPUTS from the environment)");
    process.exit(1);
  }
  let outputs;
  try {
    outputs = JSON.parse(process.env.RELEASE_OUTPUTS || "");
  } catch (error) {
    console.error(`credit-release-authors: RELEASE_OUTPUTS is missing or not valid JSON: ${error.message}`);
    process.exit(1);
  }
  if (!("paths_released" in outputs)) {
    console.error("credit-release-authors: RELEASE_OUTPUTS carries no paths_released — nothing to credit");
    process.exit(1);
  }
  try {
    main(repo, outputs);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
