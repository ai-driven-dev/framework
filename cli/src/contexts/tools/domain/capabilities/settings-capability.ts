import { CapabilityConfigError } from "../../../../kernel/errors.js";
import type { MergeStrategy } from "../../../../kernel/merge.js";
import type { ConfigAsset } from "../../../../kernel/ports/asset-provider.js";
import type { ToolId } from "../../../../kernel/tool.js";

type SettingsCapabilityParams = {
  outputPath: string;
  mergeStrategy: MergeStrategy;
  consumes?: readonly string[];
  staticContent?: string;
  staticContentAssetFile?: string;
  requiresTool?: ToolId;
};

export class SettingsCapability {
  readonly #params: SettingsCapabilityParams;

  constructor(params: SettingsCapabilityParams) {
    this.#params = params;
    if (params.staticContent !== undefined && params.staticContentAssetFile !== undefined) {
      throw new CapabilityConfigError(
        "SettingsCapability: set either 'staticContent' or 'staticContentAssetFile', not both."
      );
    }
    const hasStaticForm =
      params.staticContent !== undefined || params.staticContentAssetFile !== undefined;
    if (params.consumes?.length && hasStaticForm) {
      throw new CapabilityConfigError(
        "SettingsCapability: set either 'consumes' or 'staticContent', not both."
      );
    }
    if (params.requiresTool !== undefined && !hasStaticForm) {
      throw new CapabilityConfigError(
        "SettingsCapability: 'requiresTool' is only meaningful with 'staticContent'."
      );
    }
  }

  consumes(configName: string): boolean {
    return this.#params.consumes?.includes(configName) ?? false;
  }

  /** The tool that must be installed for this section's content to apply, or `null`. */
  requiredTool(): ToolId | null {
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

  accepts(relativePath: string): boolean {
    return relativePath === this.#params.outputPath;
  }

  mergeStrategy(): MergeStrategy {
    return this.#params.mergeStrategy;
  }

  outputPath(): string {
    return this.#params.outputPath;
  }

  equals(other: SettingsCapability): boolean {
    return (
      this.#params.outputPath === other.#params.outputPath &&
      this.#params.mergeStrategy === other.#params.mergeStrategy
    );
  }
}
