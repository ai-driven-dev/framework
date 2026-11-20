import { basename, dirname, join, relative } from "node:path";
import { describeError } from "../../../../shared/domain/describe-error.js";
import {
  FlatMergeTargetNotJsonError,
  FlatTargetExistsError,
  McpConfigError,
} from "../../../../shared/domain/errors.js";
import { parseFrontmatter, serializeFrontmatter } from "../../../../shared/domain/markdown.js";
import { flatMcpKeyPrefix } from "../../../../shared/domain/materialization/flat-paths.js";
import { rewritePluginRootInJson } from "../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import { rewriteRelativeLinks } from "../../../../shared/domain/materialization/relative-link-rewrite.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import type { AssetProvider } from "../../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type {
  ArtifactContract,
  ToolBuildContract,
} from "../../../tools/contract/build-contract.js";
import { PLUGIN_MCP_RELATIVE } from "../../domain/canon-format.js";
import { flatHooksBridgeFile } from "../../domain/flat-layout.js";
import { assertNoToolsPlaceholder } from "../shared-plugin-helpers.js";

export type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;
/** What a flat MCP merge needs of its artifact: the merge, and where its file lives. */
export type FlatMcpTarget = Required<Pick<SupportedArtifact, "merge" | "mergeDest">>;

/** What a flat write needs of a build: the contract, the overwrite flag and both directories. */
export interface FlatTarget {
  readonly contract: ToolBuildContract;
  readonly force: boolean;
  readonly sourceDir: string;
  readonly outDir: string;
}

function parsePluginMcp(pluginName: string, content: string): unknown {
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new McpConfigError(
      `Cannot parse plugin '${pluginName}' MCP config: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/** Writes a built plugin into one flat tool directory, merging into the files other plugins share. */
export class FlatWriter {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly assetProvider: AssetProvider,
    private readonly logger: Logger
  ) {}

  async writeConfig(t: FlatTarget, builtPlugins: readonly { name: string }[]): Promise<number> {
    const step = t.contract.configArtifact;
    if (!step) return 0;
    const names = builtPlugins.map((p) => p.name);
    const files = step.emit({
      builtPlugins: names,
      pluginMcp: await this.readPluginMcp(t, names),
      existing: await this.readEach(step.reads(names), (relPath) => join(t.outDir, relPath)),
      present: await this.presentOf(step.probes(names), t.outDir),
      assets: new Map(
        step.assets.names.map((name) => [
          name,
          this.assetProvider.loadConfigAsset(step.assets.tool, name),
        ])
      ),
    });
    for (const file of files) await this.fs.writeFile(join(t.outDir, file.path), file.content);
    return files.length;
  }

  /** One plugin's flat hooks: the hooks file or the bridge, then the scripts it points at. */
  async writeHooks(
    t: FlatTarget,
    artifact: SupportedArtifact,
    pluginName: string,
    hooksSrc: string,
    pluginSrc: string
  ): Promise<number> {
    const jsonCount = artifact.skipHooksJson
      ? await this.writeHooksBridgeIfDeclared(t, artifact, pluginName, hooksSrc)
      : await this.writeFlatHooksJson(t, artifact, pluginName, hooksSrc);
    return jsonCount + (await this.writeFlatHooksScripts(t, artifact, pluginName, pluginSrc));
  }

  /** Each built plugin's `.mcp.json`, its plugin-root paths already resolved into the output, as
   * the per-plugin MCP merge resolves them. */
  private async readPluginMcp(
    t: FlatTarget,
    names: readonly string[]
  ): Promise<ReadonlyMap<string, string>> {
    const raw = await this.readEach(names, (name) =>
      join(t.sourceDir, "plugins", name, PLUGIN_MCP_RELATIVE)
    );
    const resolved = new Map<string, string>();
    for (const [name, content] of raw) {
      const rewritten = rewritePluginRootInJson(parsePluginMcp(name, content), (suffix) =>
        this.resolvePluginRootAbsolute(t, suffix, name)
      );
      resolved.set(name, JSON.stringify(rewritten));
    }
    return resolved;
  }

  private async presentOf(relPaths: readonly string[], outDir: string): Promise<Set<string>> {
    const present = new Set<string>();
    for (const relPath of relPaths) {
      if (await this.fs.fileExists(join(outDir, relPath))) present.add(relPath);
    }
    return present;
  }

  /** Each key's file content, for the keys whose file exists. */
  private async readEach(
    keys: readonly string[],
    pathOf: (key: string) => string
  ): Promise<ReadonlyMap<string, string>> {
    const found = new Map<string, string>();
    for (const key of keys) {
      const path = pathOf(key);
      if (await this.fs.fileExists(path)) found.set(key, await this.fs.readFile(path));
    }
    return found;
  }

  async writeAgent(
    t: FlatTarget,
    artifact: SupportedArtifact,
    pluginName: string,
    absPath: string,
    agentsSrc: string
  ): Promise<number> {
    const agentBaseName = basename(absPath);
    const srcRelPath = `agents/${relative(agentsSrc, absPath).replace(/\\/g, "/")}`;
    const content = await this.fs.readFile(absPath);
    assertNoToolsPlaceholder(content, pluginName, srcRelPath);
    const flatRelPath = flatAgentPath(artifact, pluginName, agentBaseName);
    const destPath = join(t.outDir, flatRelPath);
    await this.checkCollision(t, destPath, pluginName);
    const outContent = artifact.transform
      ? artifact.transform(content, pluginName, agentBaseName)
      : this.rewriteAgentForFlat(t, content, flatRelPath, pluginName);
    await this.fs.writeFile(destPath, outContent);
    return 1;
  }

  private rewriteAgentForFlat(
    t: FlatTarget,
    content: string,
    flatRelPath: string,
    pluginName: string
  ): string {
    const { frontmatter, body } = parseFrontmatter(content);
    const rewrittenBody = rewriteRelativeLinks(body, {
      currentFilePluginRelative: flatRelPath,
      resolveTargetPath: (rel) => resolveTargetForMd(t.contract, pluginName, rel),
    });
    return serializeFrontmatter(frontmatter, rewrittenBody);
  }

  async writeSkill(
    t: FlatTarget,
    artifact: SupportedArtifact,
    pluginName: string,
    absPath: string,
    skillsSrc: string
  ): Promise<number> {
    const relFromSkills = relative(skillsSrc, absPath).replace(/\\/g, "/");
    const flatRelPath = artifact.path(pluginName, `skills/${relFromSkills}`);
    const destPath = join(t.outDir, flatRelPath);
    await this.checkCollision(t, destPath, pluginName);
    const content = await this.fs.readFile(absPath);
    if (!absPath.endsWith(".md")) {
      await this.fs.writeFile(destPath, content);
      return 1;
    }
    assertNoToolsPlaceholder(content, pluginName, relFromSkills);
    const rewritten = rewriteRelativeLinks(content, {
      currentFilePluginRelative: flatRelPath,
      resolveTargetPath: (rel) => resolveTargetForMd(t.contract, pluginName, rel),
    });
    const outContent =
      artifact.rewriteSkillName && basename(absPath) === "SKILL.md"
        ? rewriteSkillNameFrontmatter(rewritten, flatRelPath)
        : rewritten;
    await this.fs.writeFile(destPath, outContent);
    return 1;
  }

  private async writeFlatHooksJson(
    t: FlatTarget,
    artifact: SupportedArtifact,
    pluginName: string,
    hooksSrc: string
  ): Promise<number> {
    const file = artifact.hooksFile;
    if (file === undefined) return 0;
    const destPath = join(t.outDir, file.path(pluginName));
    if (!file.shared) await this.checkCollision(t, destPath, pluginName);
    const existing = file.shared ? await this.readSharedHooksTarget(t.outDir, destPath) : null;
    const raw = await this.fs.readFile(hooksSrc);
    const { content, warnings } = file.merge(existing, {
      json: raw,
      plugin: pluginName,
      locate: (pluginPath) => `./${resolveSuffixToFlatPath(t.contract, pluginPath, pluginName)}`,
    });
    for (const w of warnings) this.logger.warn(w);
    await this.fs.writeFile(destPath, content);
    return 1;
  }

  private async readSharedHooksTarget(outDir: string, destPath: string): Promise<string | null> {
    if (!(await this.fs.fileExists(destPath))) return null;
    const content = await this.fs.readFile(destPath);
    assertParsableJson(content, outDir, destPath);
    return content;
  }

  // OpenCode reads no hooks.json, so a plugin's declared hooks have no trigger there unless a
  // generated bridge replaces the manifest a native host would read. Raw content only: the
  // bridge resolves its own scripts from its own `import.meta.url`, never from an outDir-relative
  // path this sink would otherwise rewrite for it.
  private async writeHooksBridgeIfDeclared(
    t: FlatTarget,
    artifact: SupportedArtifact,
    pluginName: string,
    hooksSrc: string
  ): Promise<number> {
    const bridge = artifact.hooksBridge;
    if (!bridge) return 0;
    const shipsItsOwn = await this.fs.fileExists(join(dirname(hooksSrc), bridge.skipIfSourceHas));
    const generated = flatHooksBridgeFile(
      bridge,
      await this.fs.readFile(hooksSrc),
      pluginName,
      shipsItsOwn
    );
    if (generated === null) return 0;
    const destPath = join(t.outDir, generated.relativePath);
    await this.checkCollision(t, destPath, pluginName);
    await this.fs.writeFile(destPath, generated.content);
    return 1;
  }

  private async writeFlatHooksScripts(
    t: FlatTarget,
    artifact: SupportedArtifact,
    pluginName: string,
    pluginSrc: string
  ): Promise<number> {
    const hooksDir = join(pluginSrc, "hooks");
    let count = 0;
    for (const absPath of await this.fs.listFilesRecursive(hooksDir)) {
      if (absPath.endsWith("hooks.json")) continue;
      const pluginPath = `hooks/${relative(hooksDir, absPath).replace(/\\/g, "/")}`;
      const destPath = join(t.outDir, artifact.path(pluginName, pluginPath));
      await this.checkCollision(t, destPath, pluginName);
      const content = await this.fs.readFile(absPath);
      await this.fs.writeFile(destPath, artifact.script?.(pluginPath, content) ?? content);
      count++;
    }
    return count;
  }

  async writeMcp(
    t: FlatTarget,
    target: FlatMcpTarget,
    pluginName: string,
    mcpSrc: string
  ): Promise<number> {
    const parsed = asPlainObject(JSON.parse(await this.fs.readFile(mcpSrc)));
    const servers = asPlainObject(parsed?.mcpServers) ?? {};
    const prefix = flatMcpKeyPrefix(pluginName);
    const prefixed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(servers)) {
      prefixed[`${prefix}${key}`] = rewritePluginRootInJson(value, (suffix) =>
        this.resolvePluginRootAbsolute(t, suffix, pluginName)
      );
    }
    const mcpDest = target.mergeDest(t.outDir);
    const existingContent = (await this.fs.fileExists(mcpDest))
      ? await this.fs.readFile(mcpDest)
      : null;
    const { mergedContent, collisions } = target.merge(existingContent, prefixed, t.force);
    if (collisions.length > 0) throw new FlatTargetExistsError(mcpDest, pluginName);
    await this.fs.writeFile(mcpDest, mergedContent);
    return 1;
  }

  // "/"-joined and separator-normalized: this value is embedded into written JSON content, and
  // on Windows `outDir` is backslash-native: JSON.stringify then escapes each backslash, so a
  // reader comparing against the plain outDir string never finds it as a substring.
  private resolvePluginRootAbsolute(t: FlatTarget, suffix: string, pluginName: string): string {
    const normalizedOut = t.outDir.replace(/\\/g, "/");
    return `${normalizedOut}/${resolveSuffixToFlatPath(t.contract, suffix, pluginName)}`;
  }

  private async checkCollision(t: FlatTarget, destPath: string, pluginName: string) {
    if (!t.force && (await this.fs.fileExists(destPath))) {
      throw new FlatTargetExistsError(destPath, pluginName);
    }
  }
}

/** Where an agent lands, whatever folder under `agents/` holds it: the one path its writer, a
 * command naming it and a link to it all resolve to. */
function flatAgentPath(artifact: SupportedArtifact, pluginName: string, agentFile: string) {
  return artifact.path(pluginName, `agents/${basename(agentFile)}`);
}

function assertParsableJson(content: string, outDir: string, destPath: string): void {
  try {
    JSON.parse(content);
  } catch (err) {
    const shown = relative(outDir, destPath).replace(/\\/g, "/");
    throw new FlatMergeTargetNotJsonError(shown, describeError(err));
  }
}

function rewriteSkillNameFrontmatter(content: string, flatRelPath: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const parts = flatRelPath.split("/");
  const skillFolder = parts[parts.length - 2];
  if (!skillFolder) return content;
  return serializeFrontmatter({ ...frontmatter, name: skillFolder }, body);
}

function resolveSuffixToFlatPath(
  contract: ToolBuildContract,
  suffix: string,
  pluginName: string
): string {
  const art = contract.artifacts;
  if (suffix.startsWith("agents/") && art.agents.supported) {
    return flatAgentPath(art.agents, pluginName, suffix);
  }
  if (suffix.startsWith("skills/") && art.skills.supported) {
    return art.skills.path(pluginName, `skills/${suffix.slice("skills/".length)}`);
  }
  if (suffix.startsWith("hooks/") && art.hooks.supported) {
    return art.hooks.path(pluginName, `hooks/${suffix.slice("hooks/".length)}`);
  }
  return suffix;
}

function resolveTargetForMd(
  contract: ToolBuildContract,
  pluginName: string,
  pluginRelPath: string
): string {
  const art = contract.artifacts;
  if (pluginRelPath.startsWith("agents/") && art.agents.supported) {
    return flatAgentPath(art.agents, pluginName, pluginRelPath);
  }
  if (pluginRelPath.startsWith("skills/") && art.skills.supported) {
    return art.skills.path(pluginName, pluginRelPath);
  }
  return pluginRelPath;
}
