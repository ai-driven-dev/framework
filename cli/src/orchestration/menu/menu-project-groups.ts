import type { MenuBranch, MenuLeaf } from "./menu-node.js";

const DOCTOR_LEAVES: MenuLeaf[] = [
  {
    name: "Doctor",
    value: "doctor",
    description: "Tool inventory, drift, plugins, and structural health",
    command: ["doctor"],
  },
];

const PLUGIN_LIST_LEAF: MenuLeaf = {
  name: "Plugins",
  value: "plugin-list",
  description: "Show installed plugins per tool",
  command: ["plugin", "list"],
};

function doctorOneTool(toolPrompt: string): MenuLeaf {
  return {
    name: "Doctor (one tool)",
    value: "doctor-tool",
    description: "Scope the report to a single AI or IDE tool",
    command: ["doctor", "--tool"],
    inputPrompt: toolPrompt,
  };
}

export function inspectGroup(toolPrompt: string): MenuBranch {
  return {
    name: "Inspect",
    value: "inspect",
    description: "Check status, health and installed items",
    children: [...DOCTOR_LEAVES, doctorOneTool(toolPrompt), PLUGIN_LIST_LEAF],
  };
}

function installTool(toolPrompt: string): MenuLeaf {
  return {
    name: "Install",
    value: "framework-install",
    description: "Add a tool to this project",
    command: ["framework", "install", "--tool"],
    inputPrompt: toolPrompt,
  };
}

const TOOL_LEAVES: MenuLeaf[] = [
  {
    name: "Remove",
    value: "framework-remove",
    description: "Remove an installed tool",
    command: ["framework", "remove", "--tool"],
    inputPrompt: "Tool to remove",
  },
  {
    name: "Update all",
    value: "framework-update-all",
    description: "Re-install every installed tool's configs from bundled assets",
    command: ["framework", "update"],
  },
  {
    name: "Update one",
    value: "framework-update-one",
    description: "Re-install one tool's configs from bundled assets",
    command: ["framework", "update", "--tool"],
    inputPrompt: "Tool to update",
  },
];

export function toolsGroup(toolPrompt: string): MenuBranch {
  return {
    name: "Manage tools",
    value: "manage-tools",
    description: "Install, remove and update AI or IDE tools",
    children: [installTool(toolPrompt), ...TOOL_LEAVES],
  };
}

const PLUGIN_LEAVES: MenuLeaf[] = [
  {
    name: "Install plugin",
    value: "plugin-install",
    description: "Install a plugin by name, local path, or interactive pick",
    command: ["plugin", "install"],
    inputPrompt: "Plugin name, path, or leave empty for interactive pick",
  },
  {
    name: "Search",
    value: "plugin-search",
    description: "Search plugins across all registered marketplaces",
    command: ["plugin", "search"],
    inputPrompt: "Search query",
  },
  {
    name: "Update",
    value: "plugin-update",
    description: "Update all installed plugins to latest version",
    command: ["plugin", "update"],
  },
  {
    name: "Remove",
    value: "plugin-remove",
    description: "Remove an installed plugin",
    command: ["plugin", "remove"],
    inputPrompt: "Plugin name to remove",
  },
  {
    name: "List",
    value: "plugin-list-2",
    description: "Show all installed plugins per tool",
    command: ["plugin", "list"],
  },
  {
    name: "Doctor",
    value: "plugin-doctor",
    description: "Check one plugin's installation health",
    command: ["doctor", "--plugin"],
    inputPrompt: "Plugin name",
  },
];

export function pluginsGroup(): MenuBranch {
  return {
    name: "Manage plugins",
    value: "manage-plugins",
    description: "Browse, install and manage AI tool plugins",
    children: PLUGIN_LEAVES,
  };
}
