import { createHash } from "node:crypto";
import { parseFrontmatter } from "../../../../../kernel/markdown.js";

const PREFIX = "<!-- aidd_opencode_rules:";
const END = `${PREFIX}end -->`;
const START = /^<!-- aidd_opencode_rules:start sha256=([a-f0-9]{64}) separator=([01]) -->\r?\n$/;

interface Marker {
  offset: number;
  text: string;
}

function markers(content: string): Marker[] {
  const found: Marker[] = [];
  let fence: string | undefined;
  let offset = 0;
  for (const line of content.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const match = /^ {0,3}(`{3,}|~{3,})(.*?)(?:\r?\n)?$/.exec(line);
    if (match) {
      const run = match[1];
      if (fence === undefined) fence = run;
      else if (run[0] === fence[0] && run.length >= fence.length && !match[2].trim())
        fence = undefined;
    } else if (fence === undefined && line.includes(PREFIX)) {
      found.push({ offset, text: line });
    }
    offset += line.length;
  }
  if (fence !== undefined)
    throw new Error("Unclosed Markdown fence; close it before publishing OpenCode rules.");
  return found;
}

function signature(body: string, separator: string): string {
  return createHash("sha256").update(`${separator}\0${body}`).digest("hex");
}

function contribution(
  content: string
): { start: number; end: number; separator: string } | undefined {
  const found = markers(content);
  if (!found.length) return undefined;
  const start = START.exec(found[0].text);
  if (found.length !== 2 || !start || found[1].text !== `${END}\n`) {
    throw new Error(
      "AGENTS.md has duplicate or incomplete AIDD OpenCode rule markers. Restore the intact block before retrying."
    );
  }
  const separator = start[2] === "1" ? "\n" : "";
  const bodyStart = found[0].offset + found[0].text.length;
  const body = content.slice(bodyStart, found[1].offset);
  const begin = found[0].offset - separator.length;
  if (
    begin < 0 ||
    content.slice(begin, found[0].offset) !== separator ||
    signature(body, separator) !== start[1]
  ) {
    throw new Error(
      "AGENTS.md AIDD OpenCode rule block was edited. Move edits to .opencode/rules and restore the intact block before retrying."
    );
  }
  return { start: begin, end: found[1].offset + found[1].text.length, separator };
}

function renderRule(source: { path: string; content: string }): string {
  if (
    source.content.includes("\0") ||
    (source.content.startsWith("---") &&
      !/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(source.content))
  ) {
    throw new Error(
      `Unsafe OpenCode rule source: ${source.path}. Fix its frontmatter or reserved markers before retrying.`
    );
  }
  const { frontmatter, body } = parseFrontmatter(source.content);
  assertSafeRuleText(body, source.path);
  const scope = frontmatter.globs ?? frontmatter.paths;
  const predicates = [
    scope === undefined ? "" : `Apply only to matching paths: ${JSON.stringify(scope)}.`,
    frontmatter.alwaysApply === false
      ? `Apply when relevant: ${String(frontmatter.description ?? source.path)}.`
      : "",
  ].filter(Boolean);
  const rendered = `### ${source.path}\n${predicates.length ? `${predicates.join(" ")} This scope is an instruction to the model, not a native OpenCode filter.\n\n` : "\n"}${body.trimEnd()}\n`;
  assertSafeRuleText(rendered, source.path);
  return rendered;
}

function assertSafeRuleText(content: string, path: string): void {
  if (markers(content).length) {
    throw new Error(
      `Unsafe OpenCode rule source: ${path}. Remove reserved markers from active text before retrying.`
    );
  }
}

/** OpenCode V2 consumes AGENTS.md; modular files remain the editable source. */
export function publishOpencodeRules(
  existing: string,
  sources: readonly { path: string; content: string }[]
): string {
  const old = contribution(existing);
  const rendered = [...sources]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map(renderRule);
  if (!rendered.length)
    return old ? existing.slice(0, old.start) + existing.slice(old.end) : existing;
  const separator = old?.separator ?? (existing.length && !existing.endsWith("\n") ? "\n" : "");
  const body = `## AIDD OpenCode V2 rules\n\n${rendered.join("\n")}`;
  const block = `${separator}${PREFIX}start sha256=${signature(body, separator)} separator=${separator.length} -->\n${body}${END}\n`;
  const updated = old
    ? existing.slice(0, old.start) + block + existing.slice(old.end)
    : existing + block;
  contribution(updated);
  return updated;
}
