import { PluginRemoveUseCase } from "../../src/contexts/framework/application/plugin/plugin-remove-use-case.js";
import { CapturingLogger } from "./ports/capturing-logger.js";
import { InMemoryFileAdapter } from "./ports/in-memory-file-adapter.js";

type Constructed = ConstructorParameters<typeof PluginRemoveUseCase>;

/** What a test names; everything else is the empty or in-memory default. */
export interface PluginRemoverParts {
  manifestRepo: Constructed[1];
  fs?: Constructed[0];
  logger?: Constructed[2];
  activators?: Constructed[3];
  hostPluginRegistries?: Constructed[4];
  userSourceReferences?: Constructed[5];
  marketplaceRegistry?: Constructed[6];
  userManifestRepo?: Constructed[7];
  nativeMarketplaceSources?: Constructed[8];
}

export function pluginRemover(parts: PluginRemoverParts): PluginRemoveUseCase {
  return new PluginRemoveUseCase(
    parts.fs ?? new InMemoryFileAdapter(),
    parts.manifestRepo,
    parts.logger ?? new CapturingLogger(),
    parts.activators ?? new Map(),
    parts.hostPluginRegistries,
    parts.userSourceReferences,
    parts.marketplaceRegistry,
    parts.userManifestRepo,
    parts.nativeMarketplaceSources
  );
}
