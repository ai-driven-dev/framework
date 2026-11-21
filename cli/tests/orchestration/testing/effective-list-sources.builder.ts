import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";

/** A host that reports one marketplace through its effective list, rooted at a local source. */
export function effectiveListSources(toolId: AiToolId, hostName: string, source: string) {
  return new Map<AiToolId, HostMarketplaceSources>([
    [
      toolId,
      {
        read: async (projectRoot) => ({
          location: `/host/${toolId}/catalogue (cwd ${projectRoot})`,
          entries: new Map([
            [
              hostName,
              { kind: "effective-list" as const, root: source, sourceType: "local", source },
            ],
          ]),
        }),
      },
    ],
  ]);
}
