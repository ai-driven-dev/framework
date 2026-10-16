const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { dirname } = require("node:path");

const start = "<!-- aidd_global_instructions:start -->";
const end = "<!-- aidd_global_instructions:end -->";

function render(source, host) {
  const beginning = source.search(/^## Agents[ \t]*\r?$/m);
  if (beginning < 0) throw new Error("AGENTS.md has no Agents section; refusing global sync");
  const boundary = source.indexOf("\n## ", beginning + 1);
  if (!["codex", "claude", "opencode", "copilot", "cursor"].includes(host)) throw new Error(`Unknown instruction host: ${host}`);
  return source.slice(beginning, boundary < 0 ? undefined : boundary).trim();
}

function merge(existing, content) {
  const starts = existing.split(start).length - 1;
  const ends = existing.split(end).length - 1;
  if (starts !== ends || starts > 1 || (starts === 1 && existing.indexOf(start) > existing.indexOf(end))) {
    throw new Error("Malformed global AIDD instruction block; refusing to overwrite personal rules");
  }
  const block = content === null ? "" : `${start}\n${content}\n${end}`;
  if (starts === 1) {
    return existing.slice(0, existing.indexOf(start)) + block + existing.slice(existing.indexOf(end) + end.length);
  }
  if (content === null) return existing;
  return existing + (existing.endsWith("\n\n") || !existing ? "" : existing.endsWith("\n") ? "\n" : "\n\n") + block + "\n";
}

function sync(sourcePath, destinations, claudeFallback) {
  const source = readFileSync(sourcePath, "utf8");
  // Prepare every destination before writing any: a malformed block must not partially sync hosts.
  const updates = destinations.map(([host, path]) => {
    let existing = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (host === "cursor" && !existsSync(path)) existing = "---\nalwaysApply: true\n---\n";
    // Creating OpenCode's global file disables its Claude fallback. Keep those personal rules.
    if (host === "opencode" && !existsSync(path) && claudeFallback && existsSync(claudeFallback)) {
      existing = merge(readFileSync(claudeFallback, "utf8"), null);
    }
    return { path, content: merge(existing, render(source, host)) };
  });
  for (const { path, content } of updates) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

module.exports = { render, merge, sync };

if (require.main === module) {
  const [sourcePath, claudeFallback, ...args] = process.argv.slice(2);
  if (!sourcePath || claudeFallback === undefined || args.length % 2) throw new Error("Usage: sync-global-instructions.cjs SOURCE CLAUDE_FALLBACK [HOST DESTINATION ...]");
  const destinations = [];
  for (let i = 0; i < args.length; i += 2) destinations.push([args[i], args[i + 1]]);
  sync(sourcePath, destinations, claudeFallback);
}
