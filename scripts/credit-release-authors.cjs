#!/usr/bin/env node
/**
 * Appends each release-note line's commit author as `(@login)` (or their name, when they have
 * no GitHub account on the commit) to every GitHub release release-please just created.
 *
 * Workaround, not the real fix: release-please's own `include-commit-authors` option is a
 * no-op, because its commit parser drops the parsed commit's author before its default
 * changelog notes builder ever sees one. Upstream bug:
 * https://github.com/googleapis/release-please/issues/2761
 * Upstream fix, open: https://github.com/googleapis/release-please/pull/2892
 * Delete this script, its test, and its ci.yml step once a release-please carrying that fix
 * is pinned.
 *
 * `credit()` is a pure transform: given a release body and a `sha -> display name` resolver,
 * it returns the body with each creditable line credited. It never touches the network, so
 * every shape release-please's notes take is a fixture, not a live call.
 */

const { execFileSync } = require("node:child_process");

// release-please's default changelog notes link every entry's short SHA display through the
// full 40-character commit SHA in the URL: `([7fbe889](https://…/commit/<40 hex chars>))`.
const COMMIT_SHA = /\/commit\/([0-9a-f]{40})\)/;

// Checked only against the text *after* the commit-SHA link, never the whole line: what
// follows is either nothing, a `, closes [#N](url)` tail, or - once this script already
// credited the line - a space then the appended `(@login)` / `(Full Name)`. A markdown
// link's own opening parenthesis is never preceded by a space (it sits right after the link
// text's `]`), so this never fires on a bare `, closes [#N](url)` tail, and it stays true
// even when the credited name itself carries parentheses, as "Jane (JD) Doe" does, or
// brackets, as `@dependabot[bot]` does. That is the one guard that makes re-running the job
// a no-op.
const ALREADY_CREDITED = /\s\(/;

/**
 * Credits every line of `body` that names a commit SHA and is not already credited.
 * `resolve(sha)` returns the display name to append, or a falsy value to leave the line as is.
 */
function credit(body, resolve) {
  return body
    .split("\n")
    .map((line) => {
      const match = line.match(COMMIT_SHA);
      if (!match) return line;
      const tail = line.slice(match.index + match[0].length);
      if (ALREADY_CREDITED.test(tail)) return line;
      const who = resolve(match[1]);
      return who ? `${line} (${who})` : line;
    })
    .join("\n");
}

/**
 * The tags release-please created this run, read from `steps.release.outputs` (the
 * release-please-action v5.0.0 outputs, verbatim). The root release's tag is the bare
 * `tag_name` output; every other path's tag is `<path>--tag_name` — `setPathOutput` in the
 * action's own compiled bundle, read at the pinned sha before relying on it.
 */
function tagsFromOutputs(outputs) {
  const paths = JSON.parse(outputs.paths_released || "[]");
  return paths.map((releasedPath) => (releasedPath === "." ? outputs.tag_name : outputs[`${releasedPath}--tag_name`])).filter(Boolean);
}

/** Thin `gh` wrapper so the transform above stays network-free and unit-testable. */
function gh(...args) {
  return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

/**
 * Turns one `gh api repos/<repo>/commits/<sha>` JSON reply into the display name `credit()`
 * appends: `@login` when the commit's author has one, the plain commit-author name otherwise.
 * A pure function on the API's own JSON shape, not `@tsv` — a `@tsv` row with an empty first
 * field prints only a leading tab before the name, and `.trim()` (needed to drop the API
 * call's trailing newline) silently eats that tab too, so a login-less commit was reaching
 * `split("\t")` as a one-element array and getting credited as `(@Full Name)`.
 */
function who(apiReply) {
  const { login, name } = JSON.parse(apiReply);
  return login ? `@${login}` : name;
}

function resolverFor(repo) {
  const cache = new Map();
  return (sha) => {
    if (!cache.has(sha)) {
      const reply = gh("api", `repos/${repo}/commits/${sha}`, "-q", '{login: (.author.login // ""), name: .commit.author.name}');
      cache.set(sha, who(reply));
    }
    return cache.get(sha);
  };
}

/**
 * Reads, credits and writes back each tag's release body through the injected `read(tag)`,
 * `resolve(sha)` and `write(tag, body)`. Writes only the tags crediting actually changed —
 * that skip is what makes re-running the job over already-credited tags a no-op, and it is
 * unit-testable here because nothing below this line touches the network directly. Never
 * writes a partial run: a `read`, `resolve` or `write` failure on any tag throws, naming
 * that tag, before any later tag is touched.
 */
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

module.exports = { credit, tagsFromOutputs, who, creditReleases };

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
