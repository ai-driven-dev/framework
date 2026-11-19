import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";

export interface MenuLeaf {
  name: string;
  value: string;
  description?: string;
  command: string[];
  inputPrompt?: string;
  commandSuffix?: string[];
}

export interface MenuBranch {
  name: string;
  value: string;
  description?: string;
  children: MenuNode[];
}

export type MenuNode = MenuLeaf | MenuBranch;

export function isBranch(node: MenuNode): node is MenuBranch {
  return "children" in node;
}

export function toChoice(node: MenuNode): { name: string; value: string; description?: string } {
  return { name: node.name, value: node.value, description: node.description };
}

function toolPrompt(tools: ToolCatalog): string {
  return `Tool (e.g. ${[...tools.inHelpOrder("ai"), ...tools.inHelpOrder("ide")].join(", ")})`;
}

function inspectGroup(TOOL_PROMPT: string): MenuBranch {
  return {
    name: "Inspect",
    value: "inspect",
    description: "Check status, health and installed items",
    children: [
      {
        name: "Doctor",
        value: "doctor",
        description: "Tool inventory, drift, plugins, and structural health",
        command: ["doctor"],
      },
      {
        name: "Doctor (one tool)",
        value: "doctor-tool",
        description: "Scope the report to a single AI or IDE tool",
        command: ["doctor", "--tool"],
        inputPrompt: TOOL_PROMPT,
      },
      {
        name: "Plugins",
        value: "plugin-list",
        description: "Show installed plugins per tool",
        command: ["plugin", "list"],
      },
    ],
  };
}

function toolsGroup(TOOL_PROMPT: string): MenuBranch {
  return {
    name: "Manage tools",
    value: "manage-tools",
    description: "Install, remove and update AI or IDE tools",
    children: [
      {
        name: "Install",
        value: "framework-install",
        description: "Add a tool to this project",
        command: ["framework", "install", "--tool"],
        inputPrompt: TOOL_PROMPT,
      },
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
    ],
  };
}

function pluginsGroup(): MenuBranch {
  return {
    name: "Manage plugins",
    value: "manage-plugins",
    description: "Browse, install and manage AI tool plugins",
    children: [
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
    ],
  };
}

function marketplacesGroup(): MenuBranch {
  return {
    name: "Marketplaces",
    value: "marketplaces",
    description: "Manage plugin marketplace registrations",
    children: [
      {
        name: "List",
        value: "marketplace-list",
        description: "Show all registered marketplaces",
        command: ["marketplace", "list"],
      },
      {
        name: "Add",
        value: "marketplace-add",
        description: "Register a new plugin marketplace",
        command: ["marketplace", "add"],
      },
      {
        name: "Refresh",
        value: "marketplace-refresh",
        description: "Refresh all registered marketplaces",
        command: ["marketplace", "refresh"],
      },
      {
        name: "Remove",
        value: "marketplace-remove",
        description: "Unregister a marketplace",
        command: ["marketplace", "remove"],
        inputPrompt: "Marketplace name to remove",
      },
      {
        name: "Check freshness",
        value: "marketplace-check",
        description: "Report stale marketplaces",
        command: ["marketplace", "check"],
      },
    ],
  };
}

function maintainGroup(): MenuBranch {
  return {
    name: "Maintain & repair",
    value: "maintain",
    description: "Update tools, sync tracked files, and clean everything",
    children: [
      {
        name: "Update all tools",
        value: "framework-update-maintain",
        description: "Re-install every installed tool's configs from bundled assets",
        command: ["framework", "update"],
      },
      {
        name: "Sync everything",
        value: "sync-all",
        description: "Regenerate tracked files across all installed tools, driven by the manifest",
        command: ["sync"],
      },
      {
        name: "Clean (nuke .aidd)",
        value: "clean",
        description: "Remove all AIDD-managed files from this project",
        command: ["clean"],
      },
    ],
  };
}

function systemGroup(): MenuBranch {
  return {
    name: "System",
    value: "system",
    description: "CLI update and authentication",
    children: [
      {
        name: "Update CLI",
        value: "self-update",
        description: "Update the AIDD CLI binary itself (bare `update`)",
        command: ["update"],
      },
      {
        name: "Authentication",
        value: "auth",
        description: "Manage authentication credentials",
        children: [
          {
            name: "Status",
            value: "auth-status",
            description: "Show current authentication status",
            command: ["auth", "status"],
          },
          {
            name: "Login",
            value: "auth-login",
            description: "Authenticate with your credentials",
            command: ["auth", "login"],
          },
          {
            name: "Logout",
            value: "auth-logout",
            description: "Remove stored credentials",
            command: ["auth", "logout"],
          },
        ],
      },
    ],
  };
}

export function installedNodes(tools: ToolCatalog): MenuNode[] {
  const TOOL_PROMPT = toolPrompt(tools);
  return [
    inspectGroup(TOOL_PROMPT),
    toolsGroup(TOOL_PROMPT),
    pluginsGroup(),
    marketplacesGroup(),
    maintainGroup(),
    systemGroup(),
  ];
}
