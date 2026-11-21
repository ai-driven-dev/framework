import type { ProjectSetupState } from "../../contexts/installation/contract/project-setup-state.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { Prompter } from "../ports/prompter.js";
import { isBranch, type MenuLeaf, type MenuNode, toChoice } from "./menu-node.js";
import { installedNodes } from "./menu-tree.js";

const BACK = { name: "← Back", value: "back" } as const;
const EXIT = { name: "Exit", value: "exit" } as const;

type NavResult = { type: "command"; command: string[] } | { type: "back" } | { type: "exit" };

export interface BuildMenuResult {
  command: string[];
}

export class BuildMenu {
  constructor(
    private readonly projectSetup: ProjectSetupState,
    private readonly prompter: Prompter,
    private readonly tools: ToolCatalog
  ) {}

  async execute(): Promise<BuildMenuResult> {
    if (!(await this.projectSetup.isSetUp())) return this.handleFreshInstall();
    const result = await this.showMenu(
      installedNodes(this.tools),
      "What would you like to do?",
      []
    );
    if (result.type !== "command") return { command: ["exit"] };
    return { command: result.command };
  }

  private async handleFreshInstall(): Promise<BuildMenuResult> {
    const confirmed = await this.prompter.confirm("AIDD not initialized. Run setup now?", true);
    return { command: confirmed ? ["setup"] : ["exit"] };
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
