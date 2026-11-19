#!/usr/bin/env node
/**
 * Fails when this repository's own prose names a path that does not exist. The link checker
 * resolves markdown links; nothing resolved a path written in backticks.
 *
 * A reference is anchored on a real top-level entry rather than on "looks like a path":
 * widening it to any `a/b` token reports MIME types, context-relative fragments and shell
 * fragments, and a gate nobody trusts is a gate nobody reads.
 *
 * Always whole-tree — the hook's glob decides only whether this runs, never what it reads —
 * because a path dies when the file it names is deleted, in a commit that touches no page.
 * `cli/` is checked the same way, but its prose cites paths relative to the package, so it has
 * its own anchors and resolution (see CLI_CITED_PATH).
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CLI_ROOT = path.join(ROOT, "cli");

/** Prose this repository owns and can keep true. */
const SCANNED = ["docs", "aidd_docs/memory"];

/** Read from disk: a new directory joins the check by existing, and a deleted one stops
 * being an anchor rather than becoming a false positive. */
function topLevelEntries() {
  return new Set(fs.readdirSync(ROOT).filter((entry) => entry !== ".git"));
}

/**
 * Paths this repository's prose names as something the reader creates, never as its own content.
 * `.aidd/config.json` is the telemetry opt-in switch a repository commits to turn measurement on;
 * this one has not, so that absence is the state the prose describes. The anchor appears as soon
 * as a contributor runs the CLI in this checkout, which is what turned a page into a refusal.
 * `.agents/hooks.json` is the hooks file an Antigravity install writes into the reader's project;
 * this repository tracks `.agents/` for its own skills only.
 */
const READER_CREATED = new Set([".aidd/config.json", ".agents/hooks.json"]);

/** Where `cli/` prose instructs a reader; a finished plan under `aidd_docs/tasks/` is a record,
 * and holding it true would forbid ever moving a file. */
const CLI_SCANNED = [
  ".claude/rules",
  ".claude/skills",
  "aidd_docs/memory",
  "ARCHITECTURE.md",
  "README.md",
  "vitest.config.ts",
  "knip.json",
  "tsup.config.ts",
  "stryker.conf.json",
];

const FENCED_BLOCK = /```[\s\S]*?```/g;

/**
 * A `cli/` citation is rooted at the package (`src/…`, `tests/…`) or written relative to `src/`,
 * naming a top-level area (`shared/…`, `contexts/…`). A bare `application/` or `domain/` is not
 * matched: `application/json` is a media type. A name continuing a longer path
 * (an `application/` prefix before `shared/`) or a hyphenated folder (`cli-contexts/`) is not an area.
 */
const CLI_CITED_PATH =
  /\b(?:src|tests)\/[A-Za-z0-9_./-]+|(?<!-)\b(?:kernel|contexts|presentation|runtime)\/[A-Za-z0-9_./-]+|(?<!\/)\bshared\/[A-Za-z0-9_./-]+/g;

const BACKTICKED = /`([^`\n]+)`/gu;

function referencedPaths(content, entries = topLevelEntries()) {
  const found = [];
  const lines = content.split("\n");

  for (const [index, line] of lines.entries()) {
    for (const match of line.matchAll(BACKTICKED)) {
      const token = match[1].trim();
      // A command, a placeholder, a version range or a glob is not a path to resolve.
      if (/[\s<>*$|…]/u.test(token)) continue;
      if (token.startsWith(">") || token.startsWith("=")) continue;

      // Files only: a bare directory is usually a shape rather than a location, and
      // directories drift far less than the files inside them.
      if (!path.extname(token)) continue;

      if (READER_CREATED.has(token)) continue;

      const head = token.split("/")[0];
      if (!entries.has(head)) continue;

      found.push({ target: token, line: index + 1 });
    }
  }

  return found;
}

function deadReferences(files) {
  const entries = topLevelEntries();
  const dead = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const { target, line } of referencedPaths(content, entries)) {
      if (!fs.existsSync(path.resolve(ROOT, target))) {
        dead.push({ file, line, target });
      }
    }
  }

  return dead;
}

function cliCitations(content) {
  const prose = content.replace(FENCED_BLOCK, "");
  return [...new Set(prose.match(CLI_CITED_PATH) ?? [])]
    .map((cited) => cited.replace(/[./]+$/, ""))
    .filter((cited) => cited.includes("/"));
}

/** A `.js` specifier names a `.ts` file in ESM output. */
function cliPathExists(cliRoot, relativePath) {
  const exists = (candidate) => fs.existsSync(path.join(cliRoot, candidate));
  return exists(relativePath) || (relativePath.endsWith(".js") && exists(relativePath.replace(/\.js$/, ".ts")));
}

function deadCliReferences(files, cliRoot = CLI_ROOT) {
  const dead = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const target of cliCitations(content)) {
      const resolved = target.startsWith("src/") || target.startsWith("tests/") ? target : `src/${target}`;
      if (!cliPathExists(cliRoot, resolved)) dead.push({ file, target });
    }
  }

  return dead;
}

function cliFiles(cliRoot = CLI_ROOT, sources = CLI_SCANNED) {
  return sources.flatMap((source) => {
    const absolute = path.join(cliRoot, source);
    if (fs.statSync(absolute).isDirectory()) {
      return fs
        .readdirSync(absolute, { withFileTypes: true, recursive: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
    }
    return [absolute];
  });
}

function markdownUnder(dir) {
  const absolute = path.resolve(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];

  return fs
    .readdirSync(absolute, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
}

function scannedFiles() {
  const rootMarkdown = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(ROOT, entry.name));

  return [...rootMarkdown, ...SCANNED.flatMap(markdownUnder)];
}

function scanRepository() {
  const files = scannedFiles();
  const cli = cliFiles();
  return {
    scannedFiles: files.length + cli.length,
    dead: [...deadReferences(files), ...deadCliReferences(cli)],
  };
}

function run(logger = console.error, successLogger = console.log) {
  const { scannedFiles: count, dead } = scanRepository();

  if (dead.length === 0) {
    successLogger(`✅ Referenced paths: 0 dead in ${count} files`);
    return 0;
  }

  logger(`❌ ${dead.length} referenced path(s) naming nothing on disk`);
  for (const { file, line, target } of dead) {
    logger(`  ${path.relative(ROOT, file)}${line ? `:${line}` : ""}  ${target}`);
  }
  return 1;
}

module.exports = { cliFiles, deadCliReferences, deadReferences, referencedPaths, scanRepository, run };

if (require.main === module) {
  process.exit(run());
}
