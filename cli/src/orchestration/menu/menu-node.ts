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
