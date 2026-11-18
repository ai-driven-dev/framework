import type { ToolBuildContract } from "../../../src/contexts/tools/contract/build-contract.js";
import type { FrameworkBuildMode } from "../../../src/contexts/tools/contract/tool-profile.js";
import type { AiToolId, ToolId } from "../../../src/shared/domain/tool.js";
import { registeredTools } from "./registered-tools.js";

/** The build contract a registered tool declares for a mode, or null for an editor or a tool
 * that declares none. */
export function declaredBuildContract(
  id: ToolId,
  mode: FrameworkBuildMode
): ToolBuildContract | null {
  return registeredTools().aiProfileIfAny(id)?.buildContract(mode) ?? null;
}

/** The build contract of a tool a test knows declares one: refuses rather than answer null. */
export function buildContractOf(id: AiToolId, mode: FrameworkBuildMode): ToolBuildContract {
  const contract = declaredBuildContract(id, mode);
  if (contract === null) throw new Error(`${id} declares no ${mode} build contract`);
  return contract;
}
