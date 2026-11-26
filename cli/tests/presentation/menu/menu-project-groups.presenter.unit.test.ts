import { describe, expect, it } from "vitest";
import {
  isBranch,
  type MenuLeaf,
  type MenuNode,
} from "../../../src/orchestration/menu/menu-node.js";
import {
  inspectGroup,
  pluginsGroup,
  toolsGroup,
} from "../../../src/presentation/menu/menu-project-groups.presenter.js";

const leaves = (children: MenuNode[]): MenuLeaf[] =>
  children.flatMap((node) => (isBranch(node) ? [] : [node]));

describe("menu project groups", () => {
  it("asks for a tool with the given prompt where a command takes a tool flag", () => {
    const asking = [
      ...leaves(inspectGroup("Which?").children),
      ...leaves(toolsGroup("Which?").children),
    ]
      .filter((leaf) => leaf.inputPrompt === "Which?")
      .map((leaf) => leaf.value);

    expect(asking).toEqual(["doctor-tool", "framework-install"]);
  });

  it("keeps the plugin commands under the plugin group", () => {
    const commands = leaves(pluginsGroup().children).map((leaf) => leaf.command[0]);

    expect(new Set(commands)).toEqual(new Set(["plugin", "doctor"]));
  });
});
