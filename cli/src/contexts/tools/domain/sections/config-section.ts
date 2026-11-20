import { CapabilityConfigError } from "../../../../shared/domain/errors.js";
import type { ConfigAsset } from "../../../../shared/domain/file.js";
import type { MergeStrategy } from "../../../../shared/domain/merge.js";
import type { ConfigRef } from "../../contract/config-refs.js";

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

  /** The tool that must be installed for this section's content to apply, or `null`. */
  requiredTool(): string | null {
    return this.#params.requiresTool ?? null;
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

  mergeStrategy(): MergeStrategy {
    return this.#params.mergeStrategy;
  }

  outputPath(): string {
    return this.#params.outputPath;
  }
}
