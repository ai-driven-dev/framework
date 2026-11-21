import { join } from "node:path";
import type { AssetProvider } from "../../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type {
  FlatHooksStep,
  FlatMcpStep,
  FlatPluginWriter,
  FlatTarget,
} from "../../ports/flat-plugin-writer.js";
import type { BuiltPlugin } from "../../ports/plugin-tree-sink.js";
import { writeFlatHooks } from "./flat-hooks-writer.js";
import { writeFlatMcp } from "./flat-mcp-writer.js";

/** Writes a built plugin into one flat tool directory, merging into the files other plugins share. */
export class FlatWriter implements FlatPluginWriter {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly assetProvider: AssetProvider,
    private readonly logger: Logger
  ) {}

  async writeConfig(t: FlatTarget, builtPlugins: readonly BuiltPlugin[]): Promise<number> {
    const step = t.contract.configArtifact;
    if (!step) return 0;
    const names = builtPlugins.map((p) => p.name);
    const files = step.emit({
      builtPlugins: names,
      pluginMcp: new Map(
        builtPlugins.flatMap((p) => (p.declaredMcp ? [[p.name, p.declaredMcp] as const] : []))
      ),
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

  writeHooks(step: FlatHooksStep): Promise<number> {
    return writeFlatHooks(this.fs, this.logger, step);
  }

  writeMcp(step: FlatMcpStep): Promise<number> {
    return writeFlatMcp(this.fs, step);
  }
}
