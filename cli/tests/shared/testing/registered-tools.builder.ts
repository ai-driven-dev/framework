import type { RegisteredCatalog } from "../../../src/composition/contexts/tools.js";
import { wireTools } from "../../../src/composition/contexts/tools.js";
import { UnregisteredToolError } from "../../../src/shared/domain/shared.error.js";
import type { ToolId, ToolIdResolver } from "../../../src/shared/domain/tool.js";

/** The catalog of every registered tool, as the composition root wires it: wired on each call, so
 * no test shares one. */
export function registeredTools(): RegisteredCatalog {
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
    kiro: ai("kiro"),
    kimi: ai("kimi"),
    vscode: ide("vscode"),
  } as const;
})();
