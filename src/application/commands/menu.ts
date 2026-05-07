import readline from "node:readline";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import { createMenuDeps } from "../../infrastructure/deps.js";
import { spawnCliCommand } from "./shared/spawn-cli-command.js";

interface MenuLeaf {
  name: string;
  value: string;
  description?: string;
  command: string[];
  inputPrompt?: string;
  commandSuffix?: string[];
}

interface MenuBranch {
  name: string;
  value: string;
  description?: string;
  children: MenuNode[];
}

type MenuNode = MenuLeaf | MenuBranch;

function isBranch(node: MenuNode): node is MenuBranch {
  return "children" in node;
}

function toChoice(node: MenuNode): { name: string; value: string; description?: string } {
  return { name: node.name, value: node.value, description: node.description };
}

const FRESH_NODES: MenuNode[] = [
  {
    name: "Install AIDD in this project",
    value: "setup",
    description: "Set up the AI-Driven Development framework",
    command: ["setup"],
  },
];

const INSTALLED_NODES: MenuNode[] = [
  {
    name: "Inspect",
    value: "inspect",
    description: "Check status, health and installed items",
    children: [
      {
        name: "Status",
        value: "status",
        description: "Show installed files and detect drift",
        command: ["status"],
      },
      {
        name: "Doctor",
        value: "doctor",
        description: "Run a structural health check",
        command: ["doctor"],
      },
      {
        name: "List installed",
        value: "list-installed",
        description: "List installed tools and plugins",
        children: [
          {
            name: "AI tools",
            value: "ai-list",
            description: "Show installed AI tools",
            command: ["ai", "list"],
          },
          {
            name: "IDE tools",
            value: "ide-list",
            description: "Show installed IDE tools",
            command: ["ide", "list"],
          },
          {
            name: "Plugins",
            value: "plugin-list",
            description: "Show installed plugins per tool",
            command: ["plugin", "list"],
          },
        ],
      },
    ],
  },
  {
    name: "Manage AI tools",
    value: "manage-ai",
    description: "Install, remove and sync AI tools",
    children: [
      {
        name: "Install",
        value: "ai-install",
        description: "Add an AI tool to this project",
        command: ["ai", "install"],
        inputPrompt: "AI tool (e.g. claude, cursor, copilot, codex)",
      },
      {
        name: "Uninstall",
        value: "ai-uninstall",
        description: "Remove an installed AI tool",
        command: ["ai", "uninstall"],
        inputPrompt: "AI tool to remove",
      },
      {
        name: "Update",
        value: "ai-update",
        description: "Re-install AI tool configs from bundled assets",
        command: ["ai", "update"],
      },
      {
        name: "Sync",
        value: "ai-sync",
        description: "Propagate changes across installed AI tools",
        command: ["ai", "sync"],
      },
      {
        name: "Restore",
        value: "ai-restore",
        description: "Restore AI tool tracked files",
        command: ["ai", "restore"],
      },
      {
        name: "Doctor",
        value: "ai-doctor",
        description: "Check AI tool installation health",
        command: ["ai", "doctor"],
      },
    ],
  },
  {
    name: "Manage IDE tools",
    value: "manage-ide",
    description: "Install, remove and maintain IDE tools",
    children: [
      {
        name: "Install",
        value: "ide-install",
        description: "Add an IDE tool to this project",
        command: ["ide", "install"],
        inputPrompt: "IDE tool (e.g. vscode)",
      },
      {
        name: "Uninstall",
        value: "ide-uninstall",
        description: "Remove an installed IDE tool",
        command: ["ide", "uninstall"],
        inputPrompt: "IDE tool to remove",
      },
      {
        name: "Update",
        value: "ide-update",
        description: "Re-install IDE tool configs from bundled assets",
        command: ["ide", "update"],
      },
      {
        name: "Doctor",
        value: "ide-doctor",
        description: "Check IDE tool installation health",
        command: ["ide", "doctor"],
      },
    ],
  },
  {
    name: "Manage plugins",
    value: "manage-plugins",
    description: "Browse, install and manage AI tool plugins",
    children: [
      {
        name: "Install from marketplace",
        value: "plugin-install",
        description: "Install a plugin by name from registered marketplaces",
        command: ["plugin", "install"],
        inputPrompt: "Plugin name (e.g. aidd-dev or aidd-dev@1.0.0)",
      },
      {
        name: "Add local plugin",
        value: "plugin-add",
        description: "Add a plugin from a local directory",
        command: ["plugin", "add"],
        inputPrompt: "Path to plugin directory",
      },
      {
        name: "Pick (interactive)",
        value: "plugin-pick",
        description: "Interactively browse and install plugins from a marketplace",
        command: ["plugin", "pick"],
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
        value: "plugin-list",
        description: "Show all installed plugins per tool",
        command: ["plugin", "list"],
      },
      {
        name: "Sync",
        value: "plugin-sync",
        description: "Propagate plugins from source tool to targets",
        command: ["plugin", "sync"],
      },
      {
        name: "Restore",
        value: "plugin-restore",
        description: "Restore a plugin to its cached version",
        command: ["plugin", "restore"],
      },
      {
        name: "Doctor",
        value: "plugin-doctor",
        description: "Check plugin installation health",
        command: ["plugin", "doctor"],
      },
    ],
  },
  {
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
        name: "Browse",
        value: "marketplace-browse",
        description: "Browse plugins in a registered marketplace",
        command: ["marketplace", "browse"],
        inputPrompt: "Marketplace name",
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
      {
        name: "Cache",
        value: "marketplace-cache",
        description: "Manage marketplace cache",
        children: [
          {
            name: "List",
            value: "cache-list",
            description: "Show cached marketplaces with size and last fetch time",
            command: ["marketplace", "cache", "list"],
          },
          {
            name: "Clear",
            value: "cache-clear",
            description: "Clear marketplace cache",
            command: ["marketplace", "cache", "clear"],
          },
        ],
      },
    ],
  },
  {
    name: "Maintain & repair",
    value: "maintain",
    description: "Update, sync, restore and clean everything",
    children: [
      {
        name: "Update everything",
        value: "update-all",
        description: "Update all installed tools and plugins",
        command: ["update"],
      },
      {
        name: "Sync everything",
        value: "sync-all",
        description: "Sync configs and plugins across all installed tools",
        command: ["sync"],
      },
      {
        name: "Restore everything",
        value: "restore-all",
        description: "Restore all modified or deleted tracked files",
        command: ["restore"],
      },
      {
        name: "Clean (nuke .aidd)",
        value: "clean",
        description: "Remove all AIDD-managed files from this project",
        command: ["clean"],
      },
    ],
  },
  {
    name: "Migrate from older version",
    value: "migrate",
    description: "Upgrade project from a previous AIDD version",
    command: ["migrate"],
  },
  {
    name: "System",
    value: "system",
    description: "CLI self-update and authentication",
    children: [
      {
        name: "Self-update CLI",
        value: "self-update",
        description: "Update the AIDD CLI binary",
        command: ["self-update"],
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
  },
];

const BACK = { name: "← Back", value: "back" } as const;
const EXIT = { name: "Exit", value: "exit" } as const;

type NavResult = { type: "command"; command: string[] } | { type: "back" } | { type: "exit" };

export type InteractiveMenuOptions = Record<never, never>;

export interface InteractiveMenuResult {
  command: string[];
}

export class InteractiveMenuUseCase {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly prompter: Prompter
  ) {}

  async execute(_options?: InteractiveMenuOptions): Promise<InteractiveMenuResult> {
    const manifest = await this.manifestRepo.load();
    const rootNodes = manifest === null ? FRESH_NODES : INSTALLED_NODES;
    const result = await this.showMenu(rootNodes, "What would you like to do?", []);
    if (result.type !== "command") return { command: ["exit"] };
    return { command: result.command };
  }

  private async showMenu(
    nodes: MenuNode[],
    label: string,
    breadcrumb: string[]
  ): Promise<NavResult> {
    const nav = breadcrumb.length > 0 ? [BACK, EXIT] : [EXIT];
    const picked = await this.prompter.select<string>(label, [...nodes.map(toChoice), ...nav]);
    if (picked === "exit") return { type: "exit" };
    if (picked === "back") return { type: "back" };

    const node = nodes.find((n) => n.value === picked);
    if (!node) return { type: "exit" };
    if (isBranch(node)) {
      const result = await this.showMenu(node.children, node.name, [...breadcrumb, node.value]);
      if (result.type === "back") return this.showMenu(nodes, label, breadcrumb);
      return result;
    }

    return { type: "command", command: await this.resolveCommand(node) };
  }

  private async resolveCommand(node: MenuLeaf): Promise<string[]> {
    if (node.inputPrompt !== undefined) {
      const input = await this.prompter.input(node.inputPrompt);
      return [...node.command, input, ...(node.commandSuffix ?? [])];
    }
    return node.command;
  }
}

async function waitForEnter(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) => {
    rl.question("\nPress ENTER to continue...", () => {
      rl.close();
      resolve();
    });
  });
}

function printBanner(): void {
  process.stdout.write("\n  AI-Driven Dev CLI\n  ─────────────────\n\n");
}

export async function runMenuLoop(): Promise<never> {
  printBanner();
  const { manifestRepo, prompter } = createMenuDeps(process.cwd());
  for (;;) {
    try {
      const result = await new InteractiveMenuUseCase(manifestRepo, prompter).execute();
      if (result.command[0] === "exit") process.exit(0);
      await spawnCliCommand(result.command);
      await waitForEnter();
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") process.exit(0);
    }
  }
}
