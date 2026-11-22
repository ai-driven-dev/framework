import type { AiToolId } from "../../../shared/domain/tool.js";

/** A plugin the host is expected to carry, and the ref to look it up by: `ref` is absent exactly
 * when nothing can build one. */
export interface ExpectedHostPlugin {
  readonly plugin: string;
  readonly ref?: string;
}

/** A marketplace the project registers, with where this run's build of it lives. A marketplace
 * with no build, never built or gone since, is left out by the caller: nothing to compare. */
export interface InspectedMarketplace {
  readonly name: string;
  readonly builtDir: string;
}

export interface InspectedHost {
  readonly tool: AiToolId;
  readonly expectedPlugins: readonly ExpectedHostPlugin[];
  readonly marketplaces: readonly InspectedMarketplace[];
}

export interface InspectHostRegistrationRequest {
  readonly projectRoot: string;
  readonly userCacheRoot: string;
  readonly hosts: readonly InspectedHost[];
}
