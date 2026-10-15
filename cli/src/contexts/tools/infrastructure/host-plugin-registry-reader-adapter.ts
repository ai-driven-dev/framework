import { readFile, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { describeError } from "../../../kernel/describe-error.js";
import { resolveHomeDir } from "../../../kernel/reading/home-dir.js";
import { stripJsonComments } from "../../../kernel/reading/jsonc.js";
import { asPlainObject } from "../../../kernel/reading/plain-object.js";
import type { MarketplaceScope } from "../../../kernel/scope.js";
import type { AiToolId } from "../../../kernel/tool.js";
import type {
  HostPluginRegistryEntry,
  HostPluginRegistryReader,
  HostPluginRegistryReading,
} from "../domain/ports/host-plugin-registry-reader.js";
import {
  claudeConfigDir,
  claudePluginsDir,
  claudeSettingsPaths,
} from "../domain/profiles/claude/claude-paths.js";
import {
  COPILOT_MARKETPLACE_LOCATIONS,
  copilotConfigDir,
  copilotInstalledPluginDir,
  copilotSettingsPaths,
} from "../domain/profiles/copilot/copilot-paths.js";

function failedRead(location: string, error: unknown): HostPluginRegistryReading {
  if (error instanceof Error && "code" in error && error.code === "ENOENT")
    return { location, absent: true };
  return { location, unreadable: describeError(error) };
}

/**
 * One reader per host whose own plugin registry was measured; a tool absent from the map is
 * one nothing here claims to know, and the diagnostic reports it unanswerable rather than
 * assuming it agrees. The shapes measured:
 *
 *   Claude Code  ~/.claude/plugins/installed_plugins.json   { version, plugins: { ref: [ … ] } }
 *   Codex        ~/.codex/config.toml                       [plugins."ref"] enabled = true
 *   Copilot      ~/.copilot/settings.json                   { enabledPlugins: { ref: true } }
 *
 * Copilot's registry is `settings.json`, never `config.json`, whose `installedPlugins` reads
 * empty on a machine that has run installs. `copilot plugin uninstall` sets a key to `false`
 * rather than deleting it, so registered-but-off is an ordinary state, not a Codex-only one.
 */
export function hostPluginRegistryReaders(
  home: string = resolveHomeDir(),
  env: NodeJS.ProcessEnv = process.env
): ReadonlyMap<AiToolId, HostPluginRegistryReader> {
  return new Map<AiToolId, HostPluginRegistryReader>([
    [
      "claude",
      new ClaudeInstalledPluginsReader(
        join(claudePluginsDir(home, env), "installed_plugins.json"),
        claudeConfigDir(home, env)
      ),
    ],
    ["codex", new CodexConfigPluginsReader(join(home, ".codex", "config.toml"))],
    [
      "copilot",
      new CopilotSettingsPluginsReader(join(copilotConfigDir(home, env), "settings.json")),
    ],
  ]);
}

/**
 * Claude Code's own registry: a JSON document whose `plugins` object is keyed by the same
 * `<plugin>@<marketplace>` ref `enabledPlugins` uses, each key holding one entry per scope the
 * ref was installed at. Presence is not the whole answer — an entry installed at a project
 * scope also carries `projectPath`, which is what tells one project's ref from a machine-wide
 * one.
 */
class ClaudeInstalledPluginsReader implements HostPluginRegistryReader {
  constructor(
    private readonly path: string,
    private readonly configDir: string
  ) {}

  async read(projectRoot: string, forDelegation = false): Promise<HostPluginRegistryReading> {
    let content: string;
    try {
      content = await readFile(this.path, "utf8");
    } catch (error) {
      return failedRead(this.path, error);
    }
    try {
      const parsed = JSON.parse(content) as { plugins?: Record<string, ClaudeEntry[]> };
      const plugins = parsed.plugins;
      if (plugins === undefined || typeof plugins !== "object") {
        return { location: this.path, unreadable: "no `plugins` object" };
      }
      const refs = new Map<string, HostPluginRegistryEntry>();
      const activation = forDelegation
        ? await enabledPluginsAt(claudeSettingsPaths(this.configDir, projectRoot))
        : undefined;
      const here = await resolvedPath(projectRoot);
      for (const [ref, entries] of Object.entries(plugins)) {
        const scope = await scopeForProject(entries, here);
        if (scope !== null) {
          const local = await projectEntry(entries, here);
          const installPath =
            local?.installPath ?? entries.find((entry) => entry.scope === "user")?.installPath;
          refs.set(ref, {
            enabled:
              typeof activation?.get(ref) === "boolean" ? activation.get(ref) === true : true,
            scope,
            ...(typeof installPath === "string" ? { installPath } : {}),
            ...(activation !== undefined && typeof activation.get(ref) !== "boolean"
              ? {
                  activationUnverified:
                    "Local enabledPlugins settings do not establish activation; enable this plugin in Claude before resolving its agent.",
                }
              : {}),
          });
        }
      }
      return { location: this.path, refs };
    } catch (error) {
      return { location: this.path, unreadable: describeError(error) };
    }
  }
}

/**
 * Codex's own registry, line-scanned rather than parsed: the file carries arbitrary nested
 * tables and multi-line values this adapter has no business understanding, and most of it is
 * `[projects."<absolute path>"]` tables a diagnostic must not pull into a terminal. Only
 * `[plugins."<ref>"]` and the `enabled` key under it are read, and a `false` there is carried
 * through: a host that knows a plugin and declines it must not print like one that never
 * heard of it.
 */
class CodexConfigPluginsReader implements HostPluginRegistryReader {
  constructor(private readonly path: string) {}

  // `projectRoot` is unused: Codex's plugin tables carry `enabled` and nothing else — no path,
  // no scope — so its registry answers for the machine and cannot answer for one project.
  async read(_projectRoot: string): Promise<HostPluginRegistryReading> {
    let content: string;
    try {
      content = await readFile(this.path, "utf8");
    } catch (error) {
      return failedRead(this.path, error);
    }
    return { location: this.path, refs: scanCodexPluginTables(content) };
  }
}

/**
 * Copilot's own registry: `enabledPlugins` in `~/.copilot/settings.json`, keyed on the same
 * `<plugin>@<marketplace>` ref as every other host and carrying a boolean. Installation
 * diagnostics retain the user registry; delegation also applies repository activation.
 */
class CopilotSettingsPluginsReader implements HostPluginRegistryReader {
  constructor(private readonly path: string) {}

  async read(projectRoot: string, forDelegation = false): Promise<HostPluginRegistryReading> {
    try {
      const parsed = (
        forDelegation
          ? await copilotSettingsAt(copilotSettingsPaths(dirname(this.path), projectRoot))
          : JSON.parse(await readFile(this.path, "utf8"))
      ) as {
        enabledPlugins?: Record<string, unknown>;
        extraKnownMarketplaces?: Record<string, unknown>;
      } | null;
      if (parsed === null) return { location: this.path, absent: true };
      const enabled = parsed.enabledPlugins;
      // Absent is a real answer here, unlike a file that would not open: Copilot writes the
      // key on its first install, so a settings file without one carries no plugin.
      if (enabled === undefined) return { location: this.path, refs: new Map() };
      const refs = new Map<string, HostPluginRegistryEntry>();
      for (const [ref, on] of Object.entries(enabled)) {
        if (forDelegation && typeof on !== "boolean")
          throw new Error(
            `${this.path}: enabledPlugins.${ref} must be a boolean; repair this field.`
          );
        const at = ref.lastIndexOf("@");
        const registration = asPlainObject(parsed.extraKnownMarketplaces?.[ref.slice(at + 1)]);
        const source = asPlainObject(registration?.source);
        let installPath =
          forDelegation && on === true && at > 0
            ? copilotInstalledPluginDir(dirname(this.path), ref.slice(at + 1), ref.slice(0, at))
            : undefined;
        if (
          forDelegation &&
          on !== false &&
          source?.source === "directory" &&
          typeof source.path === "string"
        ) {
          let catalog: Record<string, unknown> | null = null;
          for (const relative of COPILOT_MARKETPLACE_LOCATIONS) {
            catalog = await readObjectIfPresent(join(source.path, relative));
            if (catalog !== null) break;
          }
          if (catalog === null)
            throw new Error(
              `${source.path}: no supported marketplace catalogue; repair its native registration.`
            );
          const plugin = Array.isArray(catalog.plugins)
            ? catalog.plugins.map(asPlainObject).find((entry) => entry?.name === ref.slice(0, at))
            : undefined;
          if (typeof plugin?.source === "string") {
            const pluginRoot = asPlainObject(catalog.metadata)?.pluginRoot;
            if (pluginRoot !== undefined && (typeof pluginRoot !== "string" || pluginRoot === ""))
              throw new Error(
                `${source.path}: metadata.pluginRoot must be a nonempty string; repair the catalogue.`
              );
            installPath = join(source.path, pluginRoot ?? ".", plugin.source);
          }
        }
        refs.set(ref, {
          enabled: on !== false,
          ...(installPath === undefined ? {} : { installPath }),
        });
      }
      return { location: this.path, refs };
    } catch (error) {
      return failedRead(this.path, error);
    }
  }
}

async function copilotSettingsAt(
  paths: readonly (readonly string[])[]
): Promise<Record<string, unknown> | null> {
  const scopes = await Promise.all(
    paths.map((scope) =>
      Promise.all(
        scope.map(async (path) => ({ path, source: await readObjectIfPresent(path, true) }))
      )
    )
  );
  if (scopes.every((scope) => scope.every(({ source }) => source === null))) return null;
  const enabledPlugins = new Map<string, unknown>();
  const extraKnownMarketplaces = new Map<string, unknown>();
  const conflicts = new Map<string, string>();
  for (const scope of scopes) {
    const seen = new Map<string, { path: string; value: unknown }>();
    for (const { path, source } of scope) {
      for (const [key, target] of Object.entries({ enabledPlugins, extraKnownMarketplaces })) {
        if (source?.[key] === undefined) continue;
        const entries = asPlainObject(source[key]);
        if (entries === null)
          throw new Error(`${path}: ${key} must be an object; repair this field.`);
        for (const [ref, value] of Object.entries(entries)) {
          const address = `${key}.${ref}`;
          const previous = seen.get(address);
          if (previous === undefined) conflicts.delete(address);
          else if (!isDeepStrictEqual(previous.value, value))
            conflicts.set(
              address,
              `${previous.path} and ${path}: conflicting ${address}; align these values before resolving delegation.`
            );
          seen.set(address, { path, value });
          target.set(ref, value);
        }
      }
    }
  }
  if (conflicts.size > 0) throw new Error([...conflicts.values()].join(" "));
  return {
    enabledPlugins: Object.fromEntries(enabledPlugins),
    extraKnownMarketplaces: Object.fromEntries(extraKnownMarketplaces),
  };
}

async function readObjectIfPresent(
  path: string,
  jsonc = false
): Promise<Record<string, unknown> | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonc ? stripJsonComments(raw) : raw);
  } catch {
    throw new Error(`${path}: invalid JSON; repair this settings or catalogue file.`);
  }
  const object = asPlainObject(parsed);
  if (object === null) throw new Error(`${path}: expected a JSON object; repair this file.`);
  return object;
}

async function enabledPluginsAt(paths: readonly string[]): Promise<ReadonlyMap<string, unknown>> {
  const sources = await Promise.all(paths.map((path) => readObjectIfPresent(path)));
  const result = new Map<string, unknown>();
  for (const [index, source] of sources.entries()) {
    if (source?.enabledPlugins === undefined) continue;
    const entries = asPlainObject(source.enabledPlugins);
    if (entries === null)
      throw new Error(`${paths[index]}: enabledPlugins must be an object; repair this field.`);
    for (const [ref, enabled] of Object.entries(entries)) result.set(ref, enabled);
  }
  return result;
}

const CODEX_PLUGIN_HEADER = /^\[plugins\."(.+?)"\]\s*(?:#.*)?$/u;
const CODEX_TABLE_HEADER = /^\[/u;
const CODEX_ENABLED_LINE = /^enabled\s*=\s*(true|false)\s*(?:#.*)?$/u;
const CODEX_MULTILINE_DELIMITER = /"""|'''/gu;

/**
 * Reads each plugin table's body, and only outside multi-line strings: a header spelled inside
 * one would otherwise be taken for the real table, and keeping the first occurrence of a ref
 * cannot tell a fake header from a real one. Skipping them leaves exactly one real header,
 * which TOML's own prohibition on defining a table twice then guarantees.
 *
 * Absent `enabled` reads as enabled: Codex writes the key on every table it creates, so
 * between "the host listed this plugin" and "listed it and said nothing", the listing is the
 * fact.
 */
function scanCodexPluginTables(content: string): ReadonlyMap<string, HostPluginRegistryEntry> {
  const refs = new Map<string, HostPluginRegistryEntry>();
  const lines = outsideMultilineStrings(content.split("\n"));
  for (const [index, line] of lines.entries()) {
    if (line === null) continue;
    const ref = CODEX_PLUGIN_HEADER.exec(line.trim())?.[1];
    if (ref === undefined || refs.has(ref)) continue;
    refs.set(ref, { enabled: enabledInTableBody(lines, index + 1) });
  }
  return refs;
}

/**
 * The same lines, with every one inside a multi-line string replaced by `null`. Positions are
 * preserved rather than filtered out, so a table's body still begins at the line after its
 * header; a delimiter can open and close on one line, so an odd count on a line is what flips
 * the state, and the line carrying the opening delimiter is itself outside — it is the
 * assignment, not the content.
 */
function outsideMultilineStrings(lines: readonly string[]): readonly (string | null)[] {
  let inside = false;
  return lines.map((line) => {
    const wasInside = inside;
    const delimiters = line.match(CODEX_MULTILINE_DELIMITER)?.length ?? 0;
    if (delimiters % 2 === 1) inside = !inside;
    return wasInside ? null : line;
  });
}

/** The first `enabled` assignment between a table header and the next table, defaulting to
 * enabled when the table declares none. A line inside a multi-line string is `null` here and
 * neither ends the table nor answers for it. */
function enabledInTableBody(lines: readonly (string | null)[], from: number): boolean {
  for (let at = from; at < lines.length; at += 1) {
    const line = lines[at];
    if (line === null || line === undefined) continue;
    const trimmed = line.trim();
    if (CODEX_TABLE_HEADER.test(trimmed)) return true;
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const enabled = CODEX_ENABLED_LINE.exec(trimmed);
    if (enabled !== null) return enabled[1] === "true";
  }
  return true;
}

/** One installed-plugin entry, narrowed to the two fields that decide whether a ref counts for
 * the project being diagnosed. Everything else Claude records there describes what was
 * installed, never where it applies. */
interface ClaudeEntry {
  readonly scope?: string;
  readonly projectPath?: string;
  readonly installPath?: string;
}

async function projectEntry(
  entries: readonly ClaudeEntry[],
  projectRoot: string
): Promise<ClaudeEntry | undefined> {
  for (const entry of entries) {
    if (entry.projectPath !== undefined && (await resolvedPath(entry.projectPath)) === projectRoot)
      return entry;
  }
  return undefined;
}

/** A user-scoped entry applies everywhere and carries no `projectPath`; any other scope applies
 * to the project it names, and an entry with neither is ignored rather than guessed. `null`
 * when nothing here answers for `projectRoot`. A user-scope entry wins over a project-path
 * match whatever the array's order, so a caller choosing an uninstall's own scope reads the
 * answer that is true rather than the one that sorted first. */
async function scopeForProject(
  entries: readonly ClaudeEntry[],
  projectRoot: string
): Promise<MarketplaceScope | null> {
  if (!Array.isArray(entries)) return null;
  if (entries.some((entry) => entry.scope === "user")) return "user";
  return (await projectEntry(entries, projectRoot)) === undefined ? null : "project";
}

/**
 * Both sides of the project comparison resolve through `realpath`: on macOS `/var` is a symlink
 * to `/private/var`, and comparing the raw strings there reports a registered plugin as
 * missing. A path that cannot be resolved falls back to itself rather than throwing, so a stale
 * entry for a deleted project fails to match instead of costing every other entry its answer.
 */
async function resolvedPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return path;
  }
}
