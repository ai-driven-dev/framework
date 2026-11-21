import { join } from "node:path";
import { rewritePluginRootInJson } from "../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import { McpConfigError } from "../../../../shared/domain/shared.error.js";
import type { AssetProvider } from "../../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import { PLUGIN_MCP_RELATIVE } from "../../domain/canon-format.js";
import { flatPluginRootAbsolute } from "../../domain/flat-layout.js";
import type {
  FlatFileStep,
  FlatHooksStep,
  FlatMcpStep,
  FlatPluginWriter,
  FlatTarget,
} from "../../ports/flat-plugin-writer.js";
import { writeFlatAgent, writeFlatSkill } from "./flat-content-writer.js";
import { writeFlatHooks } from "./flat-hooks-writer.js";
import { writeFlatMcp } from "./flat-mcp-writer.js";

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
export class FlatWriter implements FlatPluginWriter {
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
        flatPluginRootAbsolute(t, suffix, name)
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

  writeAgent(step: FlatFileStep): Promise<number> {
    return writeFlatAgent(this.fs, step);
  }

  writeSkill(step: FlatFileStep): Promise<number> {
    return writeFlatSkill(this.fs, step);
  }

  writeHooks(step: FlatHooksStep): Promise<number> {
    return writeFlatHooks(this.fs, this.logger, step);
  }

  writeMcp(step: FlatMcpStep): Promise<number> {
    return writeFlatMcp(this.fs, step);
  }
}
