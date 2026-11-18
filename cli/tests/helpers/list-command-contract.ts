import { marketplaceListContract } from "../../src/contexts/host-registration/infrastructure/marketplace-list-parsers.js";
import type { NativeMarketplaceSourceListContract } from "../../src/contexts/host-registration/infrastructure/native-marketplace-source-list-contract.js";
import { REGISTERED_PROFILES } from "../../src/contexts/tools/domain/profiles/registered-profiles.js";
import type { AiToolId } from "../../src/shared/domain/tool.js";

/** The list contract a tool's own declaration yields, as the composition builds it. */
export function listContractOf(tool: AiToolId): NativeMarketplaceSourceListContract {
  const config = REGISTERED_PROFILES.find((profile) => profile.toolId === tool);
  const activation = config?.kind === "ai" ? config.nativeActivation() : undefined;
  const sources = activation?.marketplaceSourcesDeclaration();
  if (activation === undefined || sources?.from !== "list-command")
    throw new Error(`${tool} declares no list-command marketplace sources`);
  return marketplaceListContract(activation.hostBinary(), sources);
}
