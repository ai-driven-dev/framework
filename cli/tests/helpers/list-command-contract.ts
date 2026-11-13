import { marketplaceListContract } from "../../src/composition/host-registration.js";
import type { NativeMarketplaceSourceListContract } from "../../src/contexts/host-registration/contract/host-marketplace-sources.js";
import type { AiToolId } from "../../src/shared/domain/tool.js";
import { registeredAiConfig } from "../contexts/tools/testing/catalog-of.js";

/** The list contract a tool's own declaration yields, as the composition builds it. */
export function listContractOf(tool: AiToolId): NativeMarketplaceSourceListContract {
  const activation = registeredAiConfig(tool).nativeActivation();
  const sources = activation?.marketplaceSourcesDeclaration();
  if (activation === undefined || sources?.from !== "list-command")
    throw new Error(`${tool} declares no list-command marketplace sources`);
  return marketplaceListContract(activation.hostBinary(), sources);
}
