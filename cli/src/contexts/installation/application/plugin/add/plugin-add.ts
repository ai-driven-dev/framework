import type { PluginSource } from "../../../../../shared/domain/source.js";
import type { AiToolId } from "../../../../../shared/domain/tool.js";

export interface AddPluginRequest {
  source: PluginSource;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  interactive: boolean;
  marketplace?: string;
  /** Whether the marketplace is a github one, whose native tools register without a fetch. */
  readonly githubMarketplace: boolean;
  requiredVersion?: string;
  pluginMetadata?: { name: string; version?: string; strict: boolean };
  /** When true, drop any existing entry with the same name before adding (idempotent re-add for setup re-runs). */
  replace?: boolean;
}

export interface PluginAdd {
  execute(options: AddPluginRequest): Promise<void>;
}
