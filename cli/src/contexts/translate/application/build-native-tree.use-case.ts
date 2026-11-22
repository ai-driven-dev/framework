import { join, resolve } from "node:path";
import { describeError } from "../../../shared/domain/describe-error.js";
import { pathsOverlap } from "../../../shared/domain/paths.js";
import { SOURCE_MARKETPLACE_RELATIVE } from "../../../shared/domain/plugin/canon-paths.js";
import type {
  SourceMarketplaceRef,
  SourcePluginEntryRef,
} from "../../../shared/domain/plugin/source-refs.js";
import { tryParseJson } from "../../../shared/domain/reading/json-file.js";
import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";
import { InvalidSourceMarketplaceError } from "../../../shared/domain/shared.error.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { FrameworkBuildMode } from "../../tools/contract/tool-profile.js";
import type {
  BuildPluginResult,
  FrameworkBuildRequest,
  FrameworkBuildResult,
} from "../contract/build-targets.js";
import { OUT_OF_SCOPE_PLUGIN_SECTIONS } from "../domain/canon-format.js";
import { InvalidBuildPathsError } from "../domain/translate.error.js";
import type {
  BuiltPlugin,
  DiskLayout,
  DiskTarget,
  PluginTreeSink,
} from "../ports/plugin-tree-sink.js";

export type BuildNativeTreeRequest = FrameworkBuildRequest;
export type BuildNativeTreeResult = FrameworkBuildResult;

/** What a build for a target and mode asks of its caller. */
export interface FrameworkBuildContext {
  readonly target: string;
  readonly mode: FrameworkBuildMode;
  readonly outDir: string;
  readonly force: boolean;
  /** The provider whose models the framework's agents run on; absent, each keeps the IDE's. */
  readonly provider?: string;
}

export interface BuildNativeTreeDeps {
  readonly fs: FileReader & FileWriter;
  readonly logger: Logger;
  readonly sink: PluginTreeSink;
  readonly layout: DiskLayout;
}

export class BuildNativeTree {
  constructor(private readonly deps: BuildNativeTreeDeps) {}

  async execute(options: BuildNativeTreeRequest): Promise<BuildNativeTreeResult> {
    const sourceDir = resolve(options.sourceDir);
    const outDir = resolve(options.outDir);
    this.guardPaths(sourceDir, outDir);
    const sourceMarketplace = await this.readSourceMarketplace(sourceDir);
    const target: DiskTarget = { ...this.deps.layout, sourceDir, outDir };
    await this.deps.sink.prepare(target);
    const builtPlugins: BuildPluginResult[] = [];
    const written: BuiltPlugin[] = [];
    for (const entry of sourceMarketplace.plugins) {
      const { result, declaredMcp } = await this.buildPlugin(target, entry);
      builtPlugins.push(result);
      written.push({ name: result.name, declaredMcp });
    }
    const extraFiles = await this.deps.sink.finish(target, sourceMarketplace, written);
    const totalFiles = builtPlugins.reduce((sum, p) => sum + p.filesWritten, 0) + extraFiles;
    return { outDir, plugins: builtPlugins, totalFiles };
  }

  private guardPaths(sourceDir: string, outDir: string): void {
    if (pathsOverlap(sourceDir, outDir)) throw new InvalidBuildPathsError(sourceDir, outDir);
  }

  private async readSourceMarketplace(sourceDir: string): Promise<SourceMarketplaceRef> {
    const marketplacePath = join(sourceDir, SOURCE_MARKETPLACE_RELATIVE);
    const raw = await this.deps.fs.readFileIfReadable(marketplacePath);
    if (raw === undefined) {
      throw new InvalidSourceMarketplaceError(`cannot read ${marketplacePath}`);
    }
    const parsed = tryParseJson(raw);
    if (!parsed.ok) {
      throw new InvalidSourceMarketplaceError(`malformed JSON: ${describeError(parsed.error)}`);
    }
    return this.validateSourceMarketplace(parsed.value);
  }

  private validateSourceMarketplace(parsed: unknown): SourceMarketplaceRef {
    const obj = asPlainObject(parsed);
    if (obj === null) {
      throw new InvalidSourceMarketplaceError("root must be an object");
    }
    if (!Array.isArray(obj.plugins)) {
      throw new InvalidSourceMarketplaceError("missing 'plugins' array");
    }
    for (const entry of obj.plugins) {
      if (typeof asPlainObject(entry)?.name !== "string") {
        throw new InvalidSourceMarketplaceError("each plugin entry must have a 'name' string");
      }
    }
    return obj as unknown as SourceMarketplaceRef;
  }

  private async buildPlugin(
    target: DiskTarget,
    entry: SourcePluginEntryRef
  ): Promise<{ result: BuildPluginResult; declaredMcp: string | null }> {
    const pluginSrc = join(target.sourceDir, "plugins", entry.name);
    if (!(await this.deps.fs.fileExists(pluginSrc))) {
      throw new InvalidSourceMarketplaceError(`plugin '${entry.name}' not found at ${pluginSrc}`);
    }
    const { files, declaredMcp } = await this.deps.sink.writePlugin(target, entry.name, pluginSrc);
    const skippedSections = await this.warnOutOfScopeSections(entry.name, pluginSrc);
    return { result: { name: entry.name, filesWritten: files, skippedSections }, declaredMcp };
  }

  private async warnOutOfScopeSections(
    pluginName: string,
    pluginSrc: string
  ): Promise<readonly string[]> {
    const skipped: string[] = [];
    for (const section of OUT_OF_SCOPE_PLUGIN_SECTIONS) {
      if (await this.deps.fs.fileExists(join(pluginSrc, section))) {
        this.deps.logger.warn(
          `Skipping ${section}/ in plugin '${pluginName}' (out of scope for MVP1).`
        );
        skipped.push(section);
      }
    }
    return skipped;
  }
}
