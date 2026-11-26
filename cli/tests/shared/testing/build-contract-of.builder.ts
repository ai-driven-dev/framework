import type { RegisteredCatalog } from "../../../src/composition/contexts/tools.js";
import type { FrameworkBuildMode } from "../../../src/contexts/tools/contract/tool-profile.js";
import type { ToolBuildContract } from "../../../src/shared/domain/materialization/build-contract.js";
import type { AiToolId, ToolId } from "../../../src/shared/domain/tool.js";

/** The build contract the catalog's tool declares for a mode, or null for an editor or a tool
 * that declares none. */
export function declaredBuildContract(
  tools: RegisteredCatalog,
  id: ToolId,
  mode: FrameworkBuildMode
): ToolBuildContract | null {
  return tools.aiProfileIfAny(id)?.buildContract(mode) ?? null;
}

/** The build contract of a tool a test knows declares one: refuses rather than answer null. */
export function buildContractOf(
  tools: RegisteredCatalog,
  id: AiToolId,
  mode: FrameworkBuildMode
): ToolBuildContract {
  const contract = declaredBuildContract(tools, id, mode);
  if (contract === null) throw new Error(`${id} declares no ${mode} build contract`);
  return contract;
}
