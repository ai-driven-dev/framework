import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../domain/ports/prompter.js";

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
    description: "Check status, health and drift detection",
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
    ],
  },
  {
    name: "Manage tools",
    value: "manage-tools",
    description: "Install, remove and sync AI tools",
    children: [
      {
        name: "Install",
        value: "install",
        description: "Add AI tools to this project",
        command: ["install"],
      },
      {
        name: "Uninstall",
        value: "uninstall",
        description: "Remove installed tools",
        command: ["uninstall"],
      },
      {
        name: "Sync",
        value: "sync",
        description: "Propagate changes across installed tools",
        command: ["sync"],
      },
    ],
  },
  {
    name: "Maintain & repair",
    value: "maintain",
    description: "Update, restore and clean your files",
    children: [
      {
        name: "Update",
        value: "update",
        description: "Pull the latest framework version",
        command: ["update"],
      },
      {
        name: "Restore",
        value: "restore",
        description: "Restore modified or deleted tracked files",
        command: ["restore"],
      },
      {
        name: "Clean",
        value: "clean",
        description: "Remove untracked or orphaned files",
        command: ["clean"],
      },
    ],
  },
  {
    name: "System",
    value: "system",
    description: "CLI updates, configuration and cache",
    children: [
      {
        name: "Self-update",
        value: "self-update",
        description: "Update the AIDD CLI binary",
        command: ["self-update"],
      },
      {
        name: "Config",
        value: "config",
        description: "View or edit project settings",
        children: [
          {
            name: "Show all settings",
            value: "list",
            description: "List all config values",
            command: ["config", "list"],
          },
          {
            name: "Get a value",
            value: "get",
            description: "Read a specific config key",
            children: [
              { name: "Docs directory", value: "docsDir", command: ["config", "get", "docsDir"] },
              { name: "Repository", value: "repo", command: ["config", "get", "repo"] },
              { name: "Installed tools", value: "tools", command: ["config", "get", "tools"] },
            ],
          },
          {
            name: "Set docs directory",
            value: "set-docs",
            description: "Change the docs folder name",
            command: ["config", "set", "docsDir"],
            inputPrompt: "New value for docsDir",
            commandSuffix: ["--force"],
          },
          {
            name: "Set repository",
            value: "set-repo",
            description: "Change the framework repository",
            command: ["config", "set", "repo"],
            inputPrompt: "New value for repo",
            commandSuffix: ["--force"],
          },
        ],
      },
      {
        name: "Cache",
        value: "cache",
        description: "Manage cached framework versions",
        children: [
          {
            name: "List cached versions",
            value: "list",
            description: "Show all cached framework versions",
            command: ["cache", "list"],
          },
          {
            name: "Clear a specific version",
            value: "clear-version",
            description: "Remove one cached version",
            command: ["cache", "clear"],
            inputPrompt: "Version to clear (e.g. v3.2.0)",
          },
          {
            name: "Clear all versions",
            value: "clear-all",
            description: "Remove all cached versions",
            command: ["cache", "clear", "--all"],
          },
        ],
      },
    ],
  },
];

const BACK = { name: "← Back", value: "back" } as const;
const EXIT = { name: "Exit", value: "exit" } as const;

type NavResult =
  | { type: "command"; command: string[]; returnTo: string[] }
  | { type: "back" }
  | { type: "exit" };

export interface InteractiveMenuOptions {
  startAt?: string[];
}

export interface InteractiveMenuResult {
  command: string[];
  returnTo?: string[];
}

export class InteractiveMenuUseCase {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly prompter: Prompter
  ) {}

  async execute(options?: InteractiveMenuOptions): Promise<InteractiveMenuResult> {
    const manifest = await this.manifestRepo.load();
    const rootNodes = manifest === null ? FRESH_NODES : INSTALLED_NODES;
    const result = await this.navigateFrom(
      rootNodes,
      "What would you like to do?",
      options?.startAt ?? [],
      []
    );
    if (result.type !== "command") return { command: ["exit"] };
    return {
      command: result.command,
      returnTo: result.returnTo.length > 0 ? result.returnTo : undefined,
    };
  }

  private async navigateFrom(
    nodes: MenuNode[],
    label: string,
    path: string[],
    breadcrumb: string[]
  ): Promise<NavResult> {
    if (path.length > 0) {
      const [head, ...tail] = path;
      const node = nodes.find((n) => n.value === head);
      if (node && isBranch(node)) {
        const result = await this.navigateFrom(node.children, node.name, tail, [
          ...breadcrumb,
          node.value,
        ]);
        if (result.type === "back") return this.showMenu(nodes, label, breadcrumb);
        return result;
      }
    }
    return this.showMenu(nodes, label, breadcrumb);
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

    return { type: "command", command: await this.resolveCommand(node), returnTo: breadcrumb };
  }

  private async resolveCommand(node: MenuLeaf): Promise<string[]> {
    if (node.inputPrompt !== undefined) {
      const input = await this.prompter.input(node.inputPrompt);
      return [...node.command, input, ...(node.commandSuffix ?? [])];
    }
    return node.command;
  }
}
