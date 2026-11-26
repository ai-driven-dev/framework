import type { ConfigArtifactFile } from "../../../../shared/domain/materialization/build-contract.js";

/** The project file a tool reads markdown guidance from, which Codex and Kimi both document as
 * their only such file.
 *
 * The plugin `05-rule-generate` writes a like block to the same file with its own markers. A skill
 * never links outside itself, so the marked-block handling exists in both places; each owns its
 * own markers and neither touches the other's. */
export const AGENTS_FILE = "AGENTS.md";

const START = "<!-- aidd_plugin_rules:start -->";
const END = "<!-- aidd_plugin_rules:end -->";
const INTRO =
  "Rules of installed plugins. A rule opening with the files it applies to covers those files, any other rule applies to every file. Before editing a file, read each rule that covers it.";
const UNPAIRED = `${AGENTS_FILE} holds a plugin rules block whose markers do not pair; repair or remove it by hand.`;
const LISTED = /^- `(.+)`$/;

interface Block {
  readonly start: number;
  readonly end: number;
  readonly globs: readonly string[];
}

/** Where `marker` stands alone on a line at or after `from`, or -1. A marker quoted inside a
 * person's sentence is not one. */
function markerLine(text: string, marker: string, from = 0): number {
  for (let at = text.indexOf(marker, from); at !== -1; at = text.indexOf(marker, at + 1)) {
    const lineStart = at === 0 || text[at - 1] === "\n";
    const after = text[at + marker.length];
    if (lineStart && (after === undefined || after === "\n")) return at;
  }
  return -1;
}

/** The block's place and globs, `null` when the text holds none. A start with no end after it, or
 * an end with no start, is not a block: the text around it is a person's to repair.
 *
 * Limit: the block is written with line feeds, as a person's own text is read. */
function blockIn(text: string): Block | null | "unpaired" {
  const start = markerLine(text, START);
  const end = markerLine(text, END);
  if (start === -1 && end === -1) return null;
  if (start === -1 || end < start || markerLine(text, START, start + 1) !== -1) return "unpaired";
  const inner = text.slice(start + START.length, end).split(/\r?\n/);
  const globs = inner.flatMap((line) => LISTED.exec(line)?.[1] ?? []);
  const after = end + END.length;
  return { start, end: text[after] === "\n" ? after + 1 : after, globs };
}

function render(globs: readonly string[]): string {
  const lines = globs.map((glob) => `- \`${glob}\``).join("\n");
  return `${START}\n${INTRO}\n\n${lines}\n${END}\n`;
}

function separatorBefore(text: string): string {
  if (text === "" || text.endsWith("\n\n")) return "";
  return text.endsWith("\n") ? "\n" : "\n\n";
}

/** The file with `glob` listed in the plugin rules block, once, after what a person wrote.
 * Refuses a block whose markers do not pair, as the generator does. */
export function addAgentsRulesGlob(existing: string | null, glob: string): string {
  const text = existing ?? "";
  const block = blockIn(text);
  if (block === "unpaired") throw new Error(UNPAIRED);
  if (block === null) return `${text}${separatorBefore(text)}${render([glob])}`;
  if (block.globs.includes(glob)) return text;
  return text.slice(0, block.start) + render([...block.globs, glob]) + text.slice(block.end);
}

/** The file without `glob` in the plugin rules block, the block dropped once empty; the file as it
 * was when `glob` is not listed. */
export function removeAgentsRulesGlob(existing: string, glob: string): string {
  const block = blockIn(existing);
  if (block === null || block === "unpaired" || !block.globs.includes(glob)) return existing;
  const kept = block.globs.filter((listed) => listed !== glob);
  const before = existing.slice(0, block.start);
  const after = existing.slice(block.end);
  if (kept.length > 0) return before + render(kept) + after;
  return (before.endsWith("\n\n") ? before.slice(0, -1) : before) + after;
}

/** The AGENTS.md a build writes to list the rules its plugins placed: none when no plugin placed any. */
export function agentsIndexFiles(
  existing: ReadonlyMap<string, string>,
  rulesGlobs: readonly string[]
): readonly ConfigArtifactFile[] {
  if (rulesGlobs.length === 0) return [];
  const content = rulesGlobs.reduce<string>(addAgentsRulesGlob, existing.get(AGENTS_FILE) ?? "");
  return [{ path: AGENTS_FILE, content }];
}
