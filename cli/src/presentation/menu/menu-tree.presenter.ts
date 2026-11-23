import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { MenuNode } from "../../orchestration/menu/menu-node.js";
import { maintainGroup, marketplacesGroup, systemGroup } from "./menu-machine-groups.presenter.js";
import { inspectGroup, pluginsGroup, toolsGroup } from "./menu-project-groups.presenter.js";

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
