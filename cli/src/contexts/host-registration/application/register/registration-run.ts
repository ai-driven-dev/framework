import type { HintedMessage } from "../../../../shared/domain/describe-error.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ClaimsView } from "../../contract/claims-view.js";
import type { CatalogIdentityReader } from "../../ports/catalog-identity-reader.js";
import type { HostActions } from "../../ports/host-actions.js";
import type { HostMarketplaceRegistry } from "../../ports/host-marketplace-registry.js";
import type { HostMarketplaceSources } from "../../ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../../ports/host-plugin-registry.js";
import type { CatalogProbeTool, NativeHostTool } from "../../ports/host-tool.js";

/** A marketplace as the host sees it: aidd's own local name and the scope it lives at. */
export interface RegistrationSubject {
  readonly name: string;
  readonly scope: Scope;
}

/** One tool's registration as it runs: what the host was asked, what this project holds, and the
 * warnings kept for the caller. */
export interface RegistrationRun {
  readonly toolId: ToolId;
  readonly profile: NativeHostTool & CatalogProbeTool;
  readonly activator: HostActions;
  readonly fs: FileReader;
  readonly identities: CatalogIdentityReader;
  readonly hosts: HostRegistries;
  readonly projectRoot: string;
  readonly claims: ClaimsView;
  readonly userCacheRoot: () => string;
  readonly platform: string;
  readonly logger: Logger;
  readonly warnings: (string | HintedMessage)[];
}

/** The per-tool registries a host's native state is read and written through. */
export interface HostRegistries {
  readonly marketplaceRegistries: ReadonlyMap<AiToolId, HostMarketplaceRegistry>;
  readonly pluginRegistries: ReadonlyMap<AiToolId, HostPluginRegistry>;
  readonly sources: ReadonlyMap<AiToolId, HostMarketplaceSources>;
}

/** Every warning goes to the logger and is kept, in order, for the caller's result. */
export function warnRegistration(run: RegistrationRun, message: string | HintedMessage): void {
  run.logger.warn(message);
  run.warnings.push(message);
}

/** The host's marketplace registry, for a tool whose profile declares one: a reader a test or a
 * caller hands for any other tool is never consulted. */
export function marketplaceRegistryOf(
  run: Pick<RegistrationRun, "hosts" | "profile">
): HostMarketplaceRegistry | undefined {
  const { profile } = run;
  return profile.nativeActivation()?.keepsMarketplaceRegistry() === true
    ? run.hosts.marketplaceRegistries.get(profile.toolId)
    : undefined;
}
