import type { ToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { HostActions } from "../../ports/host-actions.js";
import type { CatalogProbeTool, NativeHostTool } from "../../ports/host-tool.js";

export interface NativeHost {
  readonly profile: NativeHostTool & CatalogProbeTool;
  readonly binary: string;
  readonly activator: HostActions;
}

/** Answers which native plugin CLI drives a tool: its profile, the `binary` the profile declares,
 * and the activator serving that binary. Nothing when the profile declares none or no activator
 * serves it. */
export class ResolveNativeHost {
  constructor(
    private readonly activators: ReadonlyMap<string, HostActions>,
    private readonly tools: ToolCatalog
  ) {}

  execute(toolId: ToolId): NativeHost | undefined {
    const profile = this.tools.aiProfileIfAny(toolId);
    const binary = profile?.nativeActivation()?.hostBinary();
    const activator = binary === undefined ? undefined : this.activators.get(binary);
    if (profile === null || binary === undefined || activator === undefined) return undefined;
    return { profile, binary, activator };
  }
}
