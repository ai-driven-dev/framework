import { describe, expect, it } from "vitest";
import {
  isBranch,
  type MenuBranch,
  type MenuLeaf,
  toChoice,
} from "../../../src/orchestration/menu/menu-node.js";

const leaf: MenuLeaf = { name: "Doctor", value: "doctor", command: ["doctor"] };
const branch: MenuBranch = {
  name: "Inspect",
  value: "inspect",
  description: "Check status",
  children: [leaf],
};

describe("menu node", () => {
  it("tells a branch from a leaf by its children", () => {
    expect(isBranch(branch)).toBe(true);
    expect(isBranch(leaf)).toBe(false);
  });

  it("shows a node as its name, value and description only", () => {
    expect(toChoice(branch)).toEqual({
      name: "Inspect",
      value: "inspect",
      description: "Check status",
    });
  });
});
