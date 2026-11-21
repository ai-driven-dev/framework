import type {
  HostPluginRegistryEntry,
  HostPluginRegistryReading,
} from "../domain/reading/plugin-registry-reading.js";
import type { HostPluginRegistry } from "../ports/host-plugin-registry.js";
import { readPluginRegistryFile } from "./plugin-registry-file.js";

/**
 * A host registry of TOML tables, line-scanned rather than parsed: the file carries arbitrary nested
 * tables and multi-line values this adapter has no business understanding, and most of it is
 * `[projects."<absolute path>"]` tables a diagnostic must not pull into a terminal. Only
 * `[plugins."<ref>"]` and the `enabled` key under it are read, and a `false` there is carried
 * through: a host that knows a plugin and declines it must not print like one that never
 * heard of it.
 */
export class TomlPluginTablesReader implements HostPluginRegistry {
  constructor(private readonly path: string) {}

  // `projectRoot` is unused: these plugin tables carry `enabled` and nothing else: no path,
  // no scope: so its registry answers for the machine and cannot answer for one project.
  read(_projectRoot: string): Promise<HostPluginRegistryReading> {
    return readPluginRegistryFile(this.path, (content) => ({
      location: this.path,
      refs: scanTomlPluginTables(content),
    }));
  }
}

const TOML_PLUGIN_HEADER = /^\[plugins\."(.+?)"\]\s*(?:#.*)?$/u;
const TOML_TABLE_HEADER = /^\[/u;
const TOML_ENABLED_LINE = /^enabled\s*=\s*(true|false)\s*(?:#.*)?$/u;
const TOML_MULTILINE_DELIMITER = /"""|'''/gu;

/**
 * Reads each plugin table's body, and only outside multi-line strings: a header spelled inside
 * one would otherwise be taken for the real table, and keeping the first occurrence of a ref
 * cannot tell a fake header from a real one. Skipping them leaves exactly one real header,
 * which TOML's own prohibition on defining a table twice then guarantees.
 *
 * Absent `enabled` reads as enabled: the host writes the key on every table it creates, so
 * between "the host listed this plugin" and "listed it and said nothing", the listing is the
 * fact.
 */
function scanTomlPluginTables(content: string): ReadonlyMap<string, HostPluginRegistryEntry> {
  const refs = new Map<string, HostPluginRegistryEntry>();
  const lines = outsideMultilineStrings(content.split("\n"));
  for (const [index, line] of lines.entries()) {
    if (line === null) continue;
    const ref = TOML_PLUGIN_HEADER.exec(line.trim())?.[1];
    if (ref === undefined || refs.has(ref)) continue;
    refs.set(ref, { enabled: enabledInTableBody(lines, index + 1) });
  }
  return refs;
}

/**
 * The same lines, with every one inside a multi-line string replaced by `null`. Positions are
 * preserved rather than filtered out, so a table's body still begins at the line after its
 * header; a delimiter can open and close on one line, so an odd count on a line is what flips
 * the state, and the line carrying the opening delimiter is itself outside: it is the
 * assignment, not the content.
 */
function outsideMultilineStrings(lines: readonly string[]): readonly (string | null)[] {
  let inside = false;
  return lines.map((line) => {
    const wasInside = inside;
    const delimiters = line.match(TOML_MULTILINE_DELIMITER)?.length ?? 0;
    if (delimiters % 2 === 1) inside = !inside;
    return wasInside ? null : line;
  });
}

/** The first `enabled` assignment between a table header and the next table, defaulting to
 * enabled when the table declares none. A line inside a multi-line string is `null` here and
 * neither ends the table nor answers for it. */
function enabledInTableBody(lines: readonly (string | null)[], from: number): boolean {
  for (let at = from; at < lines.length; at += 1) {
    const answer = bodyLineAnswer(lines[at]);
    if (answer !== null) return answer;
  }
  return true;
}

/** What one line of a table body says of `enabled`: the next table ends it as enabled, an
 * `enabled` assignment answers, anything else says nothing (`null`). */
function bodyLineAnswer(line: string | null | undefined): boolean | null {
  if (line === null || line === undefined) return null;
  const trimmed = line.trim();
  if (TOML_TABLE_HEADER.test(trimmed)) return true;
  if (trimmed === "" || trimmed.startsWith("#")) return null;
  const enabled = TOML_ENABLED_LINE.exec(trimmed);
  return enabled === null ? null : enabled[1] === "true";
}
