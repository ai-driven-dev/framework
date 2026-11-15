import { PluginRemoveUseCase } from "../../src/contexts/framework/application/plugin/plugin-remove-use-case.js";
import { WithdrawFromHost } from "../../src/contexts/host-registration/application/withdraw-from-host.js";
import { CapturingLogger } from "./ports/capturing-logger.js";
import { InMemoryFileAdapter } from "./ports/in-memory-file-adapter.js";

type Constructed = ConstructorParameters<typeof PluginRemoveUseCase>;
type Withdrawing = ConstructorParameters<typeof WithdrawFromHost>;

/** What a test names; everything else is the empty or in-memory default. */
export interface PluginRemoverParts {
  manifestRepo: Constructed[1];
  fs?: Constructed[0];
  logger?: Constructed[2];
  activators?: Withdrawing[2];
  hostPluginRegistries?: Withdrawing[3];
  userSourceReferences?: Constructed[4];
  marketplaceRegistry?: Constructed[5];
  userManifestRepo?: Constructed[6];
  nativeMarketplaceSources?: Withdrawing[4];
}

export function pluginRemover(parts: PluginRemoverParts): PluginRemoveUseCase {
  const fs = parts.fs ?? new InMemoryFileAdapter();
  const logger = parts.logger ?? new CapturingLogger();
  return new PluginRemoveUseCase(
    fs,
    parts.manifestRepo,
    logger,
    new WithdrawFromHost(
      fs,
      logger,
      parts.activators ?? new Map(),
      parts.hostPluginRegistries ?? new Map(),
      parts.nativeMarketplaceSources ?? new Map()
    ),
    parts.userSourceReferences,
    parts.marketplaceRegistry,
    parts.userManifestRepo
  );
}
