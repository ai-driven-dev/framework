import {
  type MenuBranch,
  type MenuLeaf,
  UPDATE_ALL_TOOLS_HELP,
} from "../../orchestration/menu/menu-node.js";

const MARKETPLACE_LEAVES: MenuLeaf[] = [
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
];

export function marketplacesGroup(): MenuBranch {
  return {
    name: "Marketplaces",
    value: "marketplaces",
    description: "Manage plugin marketplace registrations",
    children: MARKETPLACE_LEAVES,
  };
}

const MAINTAIN_LEAVES: MenuLeaf[] = [
  {
    name: "Update all tools",
    value: "framework-update-maintain",
    description: UPDATE_ALL_TOOLS_HELP,
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
];

export function maintainGroup(): MenuBranch {
  return {
    name: "Maintain & repair",
    value: "maintain",
    description: "Update tools, sync tracked files, and clean everything",
    children: MAINTAIN_LEAVES,
  };
}

const AUTH_LEAVES: MenuLeaf[] = [
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
];

const AUTH_BRANCH: MenuBranch = {
  name: "Authentication",
  value: "auth",
  description: "Manage authentication credentials",
  children: AUTH_LEAVES,
};

const SELF_UPDATE_LEAF: MenuLeaf = {
  name: "Update CLI",
  value: "self-update",
  description: "Update the AIDD CLI binary itself (bare `update`)",
  command: ["update"],
};

export function systemGroup(): MenuBranch {
  return {
    name: "System",
    value: "system",
    description: "CLI update and authentication",
    children: [SELF_UPDATE_LEAF, AUTH_BRANCH],
  };
}
