import { join, resolve } from "node:path";
import {
  InvalidBuildPathsError,
  InvalidSourceMarketplaceError,
} from "../../../shared/domain/errors.js";
import { pathsOverlap } from "../../../shared/domain/paths.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type {
  SourceMarketplaceRef,
  SourcePluginEntryRef,
} from "../../tools/contract/build-contract.js";
import type { FrameworkBuildMode } from "../../tools/contract/tool-profile.js";
import type {
  BuildPluginResult,
  FrameworkBuildOptions,
  FrameworkBuildResult,
} from "../contract/build-targets.js";
import {
  OUT_OF_SCOPE_PLUGIN_SECTIONS,
  SOURCE_MARKETPLACE_RELATIVE,
} from "../domain/canon-format.js";
import type { DiskLayout, DiskSink, DiskTarget } from "./sink/disk-sink.js";

/** What a build for a target and mode asks of its caller. */
export interface FrameworkBuildContext {
  readonly target: string;
  readonly mode: FrameworkBuildMode;
  readonly outDir: string;
  readonly force: boolean;
  /** The provider whose models the framework's agents run on; absent, each keeps the IDE's. */
  readonly provider?: string;
}

export class BuildNativeTree {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly logger: Logger,
    private readonly sink: Pick<DiskSink, "prepare" | "writePlugin" | "finish">,
    private readonly layout: DiskLayout
  ) {}

  async execute(options: FrameworkBuildOptions): Promise<FrameworkBuildResult> {
    const sourceDir = resolve(options.sourceDir);
    const outDir = resolve(options.outDir);
    this.guardPaths(sourceDir, outDir);
    const sourceMarketplace = await this.readSourceMarketplace(sourceDir);
    const target: DiskTarget = { ...this.layout, sourceDir, outDir };
    await this.sink.prepare(target);
    const builtPlugins: BuildPluginResult[] = [];
    for (const entry of sourceMarketplace.plugins) {
      builtPlugins.push(await this.buildPlugin(target, entry));
    }
    const extraFiles = await this.sink.finish(target, sourceMarketplace, builtPlugins);
    const totalFiles = builtPlugins.reduce((sum, p) => sum + p.filesWritten, 0) + extraFiles;
    return { outDir, plugins: builtPlugins, totalFiles };
  }

  private guardPaths(sourceDir: string, outDir: string): void {
    if (pathsOverlap(sourceDir, outDir)) throw new InvalidBuildPathsError(sourceDir, outDir);
  }

  private async readSourceMarketplace(sourceDir: string): Promise<SourceMarketplaceRef> {
    const marketplacePath = join(sourceDir, SOURCE_MARKETPLACE_RELATIVE);
    let raw: string;
    try {
      raw = await this.fs.readFile(marketplacePath);
    } catch {
      throw new InvalidSourceMarketplaceError(`cannot read ${marketplacePath}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new InvalidSourceMarketplaceError(`malformed JSON: ${(err as Error).message}`);
    }
    return this.validateSourceMarketplace(parsed);
  }

  private validateSourceMarketplace(parsed: unknown): SourceMarketplaceRef {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new InvalidSourceMarketplaceError("root must be an object");
    }
    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.plugins)) {
      throw new InvalidSourceMarketplaceError("missing 'plugins' array");
    }
    for (const entry of obj.plugins as unknown[]) {
      if (!entry || typeof (entry as Record<string, unknown>).name !== "string") {
        throw new InvalidSourceMarketplaceError("each plugin entry must have a 'name' string");
      }
    }
    return obj as unknown as SourceMarketplaceRef;
  }

  private async buildPlugin(
    target: DiskTarget,
    entry: SourcePluginEntryRef
  ): Promise<BuildPluginResult> {
    const pluginSrc = join(target.sourceDir, "plugins", entry.name);
    if (!(await this.fs.fileExists(pluginSrc))) {
      throw new InvalidSourceMarketplaceError(`plugin '${entry.name}' not found at ${pluginSrc}`);
    }
    const filesWritten = await this.sink.writePlugin(target, entry.name, pluginSrc);
    const skippedSections = await this.warnOutOfScopeSections(entry.name, pluginSrc);
    return { name: entry.name, filesWritten, skippedSections };
  }

  private async warnOutOfScopeSections(
    pluginName: string,
    pluginSrc: string
  ): Promise<readonly string[]> {
    const skipped: string[] = [];
    for (const section of OUT_OF_SCOPE_PLUGIN_SECTIONS) {
      if (await this.fs.fileExists(join(pluginSrc, section))) {
        this.logger.warn(`Skipping ${section}/ in plugin '${pluginName}' (out of scope for MVP1).`);
        skipped.push(section);
      }
    }
    return skipped;
  }
}
