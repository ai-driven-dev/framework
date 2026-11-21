import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import { maintainGroup, marketplacesGroup, systemGroup } from "./menu-machine-groups.js";
import type { MenuNode } from "./menu-node.js";
import { inspectGroup, pluginsGroup, toolsGroup } from "./menu-project-groups.js";

function toolPrompt(tools: ToolCatalog): string {
  return `Tool (e.g. ${[...tools.inHelpOrder("ai"), ...tools.inHelpOrder("ide")].join(", ")})`;
}

export function installedNodes(tools: ToolCatalog): MenuNode[] {
  const prompt = toolPrompt(tools);
  return [
    inspectGroup(prompt),
    toolsGroup(prompt),
    pluginsGroup(),
    marketplacesGroup(),
    maintainGroup(),
    systemGroup(),
  ];
}
