import { wireTools } from "../../../src/composition/tools.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { UnregisteredToolError } from "../../../src/shared/domain/errors.js";
import type { ToolId } from "../../../src/shared/domain/tool.js";

const catalog = wireTools();

/** The catalog of every registered tool, as the composition root wires it, wired once: a catalog
 * is an immutable value. */
export function registeredTools(): ToolCatalog {
  return catalog;
}

function named<T extends ToolId>(ids: readonly T[], name: string): T {
  const found = ids.find((id) => id === name);
  if (found === undefined) throw new UnregisteredToolError(name);
  return found;
}

const ai = (name: string) => named(catalog.idsInCanonicalOrder("ai"), name);
const ide = (name: string) => named(catalog.idsInCanonicalOrder("ide"), name);

/** The registered ids, minted by the catalog: a test never writes a tool id as a string. */
export const TOOL = {
  claude: ai("claude"),
  cursor: ai("cursor"),
  copilot: ai("copilot"),
  opencode: ai("opencode"),
  kilo: ai("kilo"),
  codex: ai("codex"),
  antigravity: ai("antigravity"),
  vscode: ide("vscode"),
} as const;
