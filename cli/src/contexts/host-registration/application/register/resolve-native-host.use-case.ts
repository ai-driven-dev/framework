import type { ToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { HostActions } from "../../ports/host-actions.js";
import type { HostPorts } from "../../ports/host-ports.js";
import type { CatalogProbeTool, NativeHostTool } from "../../ports/host-tool.js";
import type { ToolHosts } from "./registration-run.js";

export interface NativeHost {
  readonly profile: NativeHostTool & CatalogProbeTool;
  readonly binary: string;
  readonly activator: HostActions;
  readonly hosts: ToolHosts;
}

/** Answers which native plugin CLI drives a tool: its profile, the `binary` the profile declares,
 * the activator serving that binary, and the registries wired for the tool. Nothing when the
 * profile declares none or no activator serves it. */
export class ResolveNativeHost {
  constructor(
    private readonly ports: HostPorts,
    private readonly tools: ToolCatalog
  ) {}

  execute(toolId: ToolId): NativeHost | undefined {
    const profile = this.tools.aiProfileIfAny(toolId);
    const binary = profile?.nativeActivation()?.hostBinary();
    const activator = binary === undefined ? undefined : this.ports.activator(binary);
    if (profile === null || binary === undefined || activator === undefined) return undefined;
    const hosts = {
      marketplaceRegistry: this.ports.marketplaceRegistry(profile.toolId),
      pluginRegistry: this.ports.pluginRegistry(profile.toolId),
      sources: this.ports.sources(profile.toolId),
    };
    return { profile, binary, activator, hosts };
  }
}
