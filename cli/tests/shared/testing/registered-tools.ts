import { wireTools } from "../../../src/composition/tools.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { UnregisteredToolError } from "../../../src/shared/domain/errors.js";
import type { ToolId, ToolIdResolver } from "../../../src/shared/domain/tool.js";

/** The catalog of every registered tool, as the composition root wires it: wired on each call, so
 * no test shares one. */
export function registeredTools(): ToolCatalog {
  return wireTools();
}

/** What the code under test asks to turn a written id into a registered one. */
export const resolveRegisteredToolId: ToolIdResolver = (raw) => registeredTools().toolId(raw);

function named<T extends ToolId>(ids: readonly T[], name: string): T {
  const found = ids.find((id) => id === name);
  if (found === undefined) throw new UnregisteredToolError(name);
  return found;
}

/** The registered ids, minted by a catalog local to this initializer: a test never writes a tool id
 * as a string. */
export const TOOL = (() => {
  const catalog = wireTools();
  const ai = (name: string) => named(catalog.idsInCanonicalOrder("ai"), name);
  const ide = (name: string) => named(catalog.idsInCanonicalOrder("ide"), name);
  return {
    claude: ai("claude"),
    cursor: ai("cursor"),
    copilot: ai("copilot"),
    opencode: ai("opencode"),
    kilo: ai("kilo"),
    codex: ai("codex"),
    antigravity: ai("antigravity"),
    vscode: ide("vscode"),
  } as const;
})();

/** The tool ids a setup flow is built over, read from the registered catalog: a flow test names no
 * tool list of its own. */
export function flowTools() {
  const tools = registeredTools();
  return {
    registeredToolIds: tools.idsInCanonicalOrder(),
    aiToolIds: tools.idsInCanonicalOrder("ai"),
    ideToolIds: tools.idsInCanonicalOrder("ide"),
  };
}
