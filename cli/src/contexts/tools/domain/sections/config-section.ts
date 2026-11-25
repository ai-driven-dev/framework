import { FileHash } from "../../../../shared/domain/file-hash.js";
import { InstallationFile } from "../../../../shared/domain/installation-file.js";
import type { MergeStrategy } from "../../../../shared/domain/merge.js";
import type { ConfigAsset } from "../../../../shared/domain/reading/config-asset.js";
import type { ConfigRef } from "../../contract/config-refs.js";
import { CapabilityConfigError } from "../../contract/errors/tools.error.js";
import type { ConfigFilePlace } from "../../contract/tool-profile.js";

type ConfigSectionParams = {
  outputPath: string;
  mergeStrategy: MergeStrategy;
  consumes?: readonly ConfigRef[];
  staticContent?: string;
  staticContentAssetFile?: string;
  requiresTool?: string;
};

export class ConfigSection {
  readonly #params: ConfigSectionParams;

  constructor(params: ConfigSectionParams) {
    this.#params = params;
    if (params.staticContent !== undefined && params.staticContentAssetFile !== undefined) {
      throw new CapabilityConfigError(
        "ConfigSection: set either 'staticContent' or 'staticContentAssetFile', not both."
      );
    }
    const hasStaticForm =
      params.staticContent !== undefined || params.staticContentAssetFile !== undefined;
    if (params.consumes?.length && hasStaticForm) {
      throw new CapabilityConfigError(
        "ConfigSection: set either 'consumes' or 'staticContent', not both."
      );
    }
    if (params.requiresTool !== undefined && !hasStaticForm) {
      throw new CapabilityConfigError(
        "ConfigSection: 'requiresTool' is only meaningful with 'staticContent'."
      );
    }
  }

  consumes(configName: string): boolean {
    return this.#params.consumes?.some((ref) => ref.name === configName) ?? false;
  }

  /** Every config artifact this section takes in, with where the canonical source keeps it. */
  consumedRefs(): readonly ConfigRef[] {
    return (this.#params.consumes ?? []).map((ref) => ({ ...ref }));
  }

  /** Whether this section's content applies, `installed` telling which tools are there: a
   * section that requires no tool always does. */
  appliesWith(installed: (toolId: string) => boolean): boolean {
    const required = this.#params.requiresTool;
    return required === undefined || installed(required);
  }

  /** Whether this section's content applies only because `toolId` is installed. */
  requires(toolId: string): boolean {
    return this.#params.requiresTool === toolId;
  }

  /** The fixed content, inline or loaded through `loadAsset`; `null` when there is none, or when
   * it lives in an asset file and no loader was given. */
  resolveStaticContent(loadAsset?: (fileName: string) => ConfigAsset): string | null {
    const { staticContent, staticContentAssetFile } = this.#params;
    if (staticContent !== undefined) return staticContent;
    if (staticContentAssetFile === undefined || loadAsset === undefined) return null;
    const asset = loadAsset(staticContentAssetFile);
    return typeof asset === "string" ? asset : JSON.stringify(asset, null, 2);
  }

  fileOf(content: string, place: ConfigFilePlace = {}): InstallationFile {
    return new InstallationFile({
      relativePath: place.relativePath ?? this.#params.outputPath,
      content,
      hash: FileHash.of(content),
      mergeStrategy: this.#params.mergeStrategy,
      frameworkPath: place.frameworkPath,
    });
  }

  /** Whether this section writes the file at `destination`. */
  writes(destination: string): boolean {
    return this.#params.outputPath === destination;
  }

  outputPath(): string {
    return this.#params.outputPath;
  }
}
