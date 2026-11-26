"use strict";
// Every markdown link, `@import` and `src:` target of the repository's markdown resolves, anchors included. Anchor: README.md.
// The logic of the former check-markdown-links script, bound to a root so a fixture tree can be checked.
const fs = require("node:fs");
const path = require("node:path");

const SKIPPED_DIRS = new Set([".git", "node_modules", "worktrees", ".specstory", ".stryker-tmp", ".e2e-build", ".aidd"]);
const SKIPPED_DIR_PREFIXES = [".tmp-check-markdown-links-"];
// Both trees hold targets meant not to resolve: synthetic mock references, and a historical record left as it was written.
const DEFAULT_IGNORES = ["cli/tests/fixtures", "cli/aidd_docs/tasks"];
const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx"]);

function linkChecker(ROOT) {
  function normalizePathForDisplay(filePath) {
    const relative = path.relative(ROOT, filePath).replaceAll(path.sep, "/");
    return relative || ".";
  }

  function normalizeForMatch(filePath) {
    return path.resolve(ROOT, filePath);
  }

  function pathStartsWith(candidate, parent) {
    const relative = path.relative(parent, candidate);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  }

  function isIgnored(filePath, ignoredPaths) {
    const absolute = path.resolve(filePath);
    return ignoredPaths.some((ignoredPath) => pathStartsWith(absolute, ignoredPath));
  }

  function collectMarkdownFiles(inputPaths, ignoredPaths = []) {
    const files = [];
    const normalizedIgnores = ignoredPaths.map((ignoredPath) => normalizeForMatch(ignoredPath));
    const missingInputs = inputPaths.filter((inputPath) => !fs.existsSync(path.resolve(ROOT, inputPath)));

    if (missingInputs.length > 0) {
      throw new Error(`Path not found: ${missingInputs.join(", ")}`);
    }

    function visit(currentPath) {
      const absolute = path.resolve(ROOT, currentPath);
      if (!fs.existsSync(absolute)) {
        return;
      }

      if (isIgnored(absolute, normalizedIgnores)) {
        return;
      }

      const stat = fs.statSync(absolute);
      if (stat.isDirectory()) {
        const basename = path.basename(absolute);
        if (SKIPPED_DIRS.has(basename) || SKIPPED_DIR_PREFIXES.some((prefix) => basename.startsWith(prefix))) {
          return;
        }

        for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
          visit(path.join(absolute, entry.name));
        }
        return;
      }

      if (stat.isFile() && MARKDOWN_EXTENSIONS.has(path.extname(absolute).toLowerCase())) {
        files.push(absolute);
      }
    }

    for (const inputPath of inputPaths) {
      visit(inputPath);
    }

    return files.sort((a, b) => normalizePathForDisplay(a).localeCompare(normalizePathForDisplay(b)));
  }

  function lineNumberAt(content, index) {
    return content.slice(0, index).split("\n").length;
  }

  function stripTrailingPunctuation(target) {
    return target.replace(/[.,;:]+$/u, "");
  }

  function splitMarkdownTarget(rawTarget) {
    const trimmed = rawTarget.trim();
    if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
      return trimmed;
    }
    return trimmed.split(/\s+/u)[0];
  }

  function extractLinks(content) {
    const links = [];
    const markdownLinkPattern = /!?\[[^\]\n]*\]\(([^)\n]+)\)/gu;
    const atPathPattern = /(^|[\n\r][ \t>*-]*)@([^\s`)\]},;]+)/gu;
    const srcPathPattern = /\bsrc:\s*([^\s`)\]},;]+)/gu;

    for (const match of content.matchAll(markdownLinkPattern)) {
      links.push({
        raw: splitMarkdownTarget(match[1]),
        index: match.index,
        kind: "markdown",
      });
    }

    for (const match of content.matchAll(atPathPattern)) {
      links.push({
        raw: `@${stripTrailingPunctuation(match[2])}`,
        index: match.index + match[1].length,
        kind: "agent-import",
      });
    }

    for (const match of content.matchAll(srcPathPattern)) {
      links.push({
        raw: stripTrailingPunctuation(match[1]),
        index: match.index,
        kind: "src",
      });
    }

    return links;
  }

  function isIgnoredTarget(target) {
    if (!target) {
      return true;
    }

    if (target.startsWith("<") && target.endsWith(">")) {
      return true;
    }

    if (/[<>]/u.test(target)) {
      return true;
    }

    if (target.startsWith("#")) {
      return true;
    }

    if (/^(mailto|tel):/iu.test(target)) {
      return true;
    }

    if (/[*?[\]]/u.test(target)) {
      return true;
    }

    if (/^\$[\w_]+/u.test(target)) {
      return true;
    }

    if (/\{\{[^}]+\}\}/u.test(target)) {
      return true;
    }

    if (!target.includes("/") && !target.includes(".") && !target.startsWith("..")) {
      return true;
    }

    return false;
  }

  function stripAnchor(target) {
    const hashIndex = target.indexOf("#");
    return hashIndex === -1 ? target : target.slice(0, hashIndex);
  }

  function anchorOf(target) {
    const hashIndex = target.indexOf("#");
    return hashIndex === -1 ? "" : target.slice(hashIndex + 1);
  }

  /** GitHub's rule, reproduced: nothing is collapsed, which is why a leading emoji leaves
   * the hyphen it was separated by and an `&` leaves two. */
  function headingSlug(text) {
    return text
      .replace(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
      .toLowerCase()
      .replace(/[^\p{L}\p{N} _-]/gu, "")
      .replaceAll(" ", "-");
  }

  /** A duplicate heading takes GitHub's `-1`, `-2` suffix, so both the bare slug and the
   * numbered one resolve. */
  function headingSlugs(absolutePath) {
    const slugs = new Set();
    const seen = new Map();
    let inFence = false;

    for (const line of fs.readFileSync(absolutePath, "utf8").split("\n")) {
      if (/^\s*(```|~~~)/u.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      const heading = line.match(/^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/u);
      if (!heading) continue;

      const base = headingSlug(heading[1]);
      if (!base) continue;

      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      slugs.add(count === 0 ? base : `${base}-${count}`);
    }

    return slugs;
  }

  function safeDecodeUri(target) {
    try {
      return decodeURI(target);
    } catch {
      return target;
    }
  }

  function isRemoteUrl(target) {
    return /^https?:\/\//iu.test(target);
  }

  function resolveLocalPath(target, sourceFile) {
    const withoutAnchor = stripAnchor(target);
    if (!withoutAnchor) {
      return { ignored: true };
    }

    const decoded = safeDecodeUri(withoutAnchor);
    if (path.isAbsolute(decoded)) {
      return { absolute: path.resolve(ROOT, decoded.slice(1)) };
    }

    const absolute = path.resolve(path.dirname(sourceFile), decoded);
    const sourceRelative = normalizePathForDisplay(sourceFile);
    const assetTemplateMatch = sourceRelative.match(/^(plugins\/[^/]+\/skills\/[^/]+\/assets)\/.+$/u);
    if (assetTemplateMatch) {
      const generatedTemplateAbsolute = path.resolve(ROOT, assetTemplateMatch[1], "templates", decoded);
      if (!fs.existsSync(absolute) && fs.existsSync(generatedTemplateAbsolute)) {
        return { absolute: generatedTemplateAbsolute };
      }
      // A *-template.md scaffold links to siblings emitted at runtime, so a dot-relative
      // target resolving nowhere is a placeholder rather than a broken link.
      if (!fs.existsSync(absolute) && /-template\.md$/u.test(sourceRelative) && /^\.\.?\//u.test(decoded)) {
        return { ignored: true };
      }
    }

    if (normalizePathForDisplay(sourceFile).startsWith(".github/")) {
      const repoRootAbsolute = path.resolve(ROOT, decoded);
      if (!fs.existsSync(absolute) && fs.existsSync(repoRootAbsolute)) {
        return { absolute: repoRootAbsolute };
      }
    }

    return { absolute };
  }

  function problemForTarget(target, sourceFile) {
    const validationTarget = target.startsWith("@") ? target.slice(1) : target;

    if (isIgnoredTarget(validationTarget)) {
      return null;
    }

    if (isRemoteUrl(validationTarget)) {
      return null;
    }

    const resolved = resolveLocalPath(validationTarget, sourceFile);
    if (resolved.ignored) {
      return null;
    }

    if (!pathStartsWith(resolved.absolute, ROOT)) {
      const repoRelative = path.relative(ROOT, resolved.absolute).replaceAll(path.sep, "/");
      return {
        raw: target,
        reason: "cross-repo-relative-link",
        suggestion: `https://github.com/ai-driven-dev/framework/blob/main/${repoRelative.replace(/^(\.\.\/)+/u, "")}`,
      };
    }

    if (!fs.existsSync(resolved.absolute)) {
      return { raw: target, reason: "local-path-not-found" };
    }

    // A fragment is checked only once the file itself resolves, or a missing file reports
    // twice for one fix. `#L119` is GitHub's line fragment: it answers to no heading.
    const anchor = /^L\d+(-L\d+)?$/u.test(anchorOf(validationTarget)) ? "" : anchorOf(validationTarget);
    if (anchor && MARKDOWN_EXTENSIONS.has(path.extname(resolved.absolute).toLowerCase())) {
      if (!headingSlugs(resolved.absolute).has(safeDecodeUri(anchor).toLowerCase())) {
        return { raw: target, reason: "anchor-not-found" };
      }
    }

    return null;
  }

  function checkFile(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const links = extractLinks(content);
    const problems = [];

    for (const link of links) {
      const problem = problemForTarget(link.raw, filePath);
      if (!problem) {
        continue;
      }

      problems.push({
        ...problem,
        file: filePath,
        line: lineNumberAt(content, link.index),
        kind: link.kind,
      });
    }

    return problems;
  }


  return { normalizePathForDisplay, isIgnored, collectMarkdownFiles, extractLinks, problemForTarget, checkFile };
}

const REASONS = {
  "cross-repo-relative-link": (p) => `${p.raw} (cross-repo relative link; suggestion: ${p.suggestion})`,
  "local-path-not-found": (p) => `${p.raw} (local path not found)`,
  "anchor-not-found": (p) => `${p.raw} (no heading in the target file answers that fragment)`,
};

module.exports = (ctx) => {
  const core = linkChecker(ctx.root);
  // Skill markdown is SKILL-17's: its links resolve from the skill's own folder; a hook's contract copies hold those skills' raw templates.
  const files = core.collectMarkdownFiles(["."], DEFAULT_IGNORES).filter((file) => !/^plugins\/[^/]+\/(?:skills|hooks\/lib\/contracts)\//u.test(core.normalizePathForDisplay(file)));
  return files.flatMap((file) => core.checkFile(file)).map((p) => ({ file: core.normalizePathForDisplay(p.file), line: p.line, offending: p.raw, fix: REASONS[p.reason](p) }));
};
module.exports.linkChecker = linkChecker;
module.exports.DEFAULT_IGNORES = DEFAULT_IGNORES;
