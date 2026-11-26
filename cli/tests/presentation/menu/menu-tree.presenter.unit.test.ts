import { describe, expect, it } from "vitest";
import {
  isBranch,
  type MenuLeaf,
  type MenuNode,
} from "../../../src/orchestration/menu/menu-node.js";
import { installedNodes } from "../../../src/presentation/menu/menu-tree.presenter.js";
import { syntheticCatalog } from "../../shared/testing/synthetic-tool-id.builder.js";

function leavesOf(nodes: MenuNode[]): MenuLeaf[] {
  return nodes.flatMap((node) => (isBranch(node) ? leavesOf(node.children) : [node]));
}

function valuesOf(nodes: MenuNode[]): string[] {
  return nodes.flatMap((node) => [node.value, ...(isBranch(node) ? valuesOf(node.children) : [])]);
}

describe("menu tree", () => {
  const nodes = installedNodes(syntheticCatalog());

  it("gives every node a value no other node shares, so a pick names one node", () => {
    const values = valuesOf(nodes);

    expect(new Set(values).size).toBe(values.length);
  });

  it("gives every leaf a command to run", () => {
    for (const leaf of leavesOf(nodes)) expect(leaf.command.length).toBeGreaterThan(0);
  });

  it("hands the input to a tool flag where the prompt asks for a tool", () => {
    const asking = leavesOf(nodes).filter((leaf) => leaf.inputPrompt?.startsWith("Tool (e.g."));

    expect(asking.map((leaf) => leaf.value)).toEqual(["doctor-tool", "framework-install"]);
    for (const leaf of asking) expect(leaf.command.at(-1)).toBe("--tool");
  });

  it("lists the tools of the catalog, AI tools first, in the prompt that asks for one", () => {
    const catalog = syntheticCatalog();
    const prompt = leavesOf(nodes).find((leaf) => leaf.value === "doctor-tool")?.inputPrompt;

    expect(prompt).toBe(
      `Tool (e.g. ${[...catalog.inHelpOrder("ai"), ...catalog.inHelpOrder("ide")].join(", ")})`
    );
  });
});
