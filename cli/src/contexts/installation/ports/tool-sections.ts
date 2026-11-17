import type { ToolId } from "../../../shared/domain/tool.js";
import type { SignalDirectory } from "../../tools/contract/tool-vocabulary.js";

/** A tool as far as a reader of its place in a project goes: where its files land, which of them
 * stay on the machine, and where its own commands sit. The tools context owns the profile and the
 * caller hands over the real one, which satisfies this shape. */
export interface ToolFootprint {
  readonly toolId: ToolId;
  readonly directory: string;
  machineLocalFiles(): readonly string[];
  signalDirectoryIn(projectRoot: string): SignalDirectory | null;
}
