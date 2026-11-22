import { Command } from "commander";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
import { offerGroupMenu } from "../../../../src/presentation/controllers/menu/group-menu.controller.js";
import { prompterAnswering } from "../../../shared/testing/partial-ports.builder.js";

const CHOICES = [
  { name: "List", value: "list" },
  { name: "Add", value: "add", description: "requires name arg" },
];

function groupWith(pick: string) {
  const select: Mock = vi.fn(async () => pick);
  const createDeps: Mock = vi.fn(async () => ({ prompter: prompterAnswering({ select }) }));
  const runCommand = vi.fn(async () => 0);
  const group = new Command("tools").exitOverride();
  offerGroupMenu(group, { question: "tools: what now?", choices: CHOICES, createDeps, runCommand });
  return { group, select, createDeps, runCommand };
}

function pretendTerminal(isTTY: boolean): void {
  Object.defineProperty(process.stdout, "isTTY", { value: isTTY, configurable: true });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("offerGroupMenu", () => {
  it("asks which subcommand to run on a terminal, then re-runs the program with the pick", async () => {
    pretendTerminal(true);
    const { group, select, runCommand } = groupWith("add");

    await group.parseAsync([], { from: "user" });

    expect(select).toHaveBeenCalledWith("tools: what now?", CHOICES);
    expect(runCommand).toHaveBeenCalledWith(["tools", "add"]);
  });

  it("prints its own help off a terminal and asks nothing", async () => {
    pretendTerminal(false);
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const { group, createDeps, runCommand } = groupWith("add");

    await expect(group.parseAsync([], { from: "user" })).rejects.toThrow();

    expect(createDeps).not.toHaveBeenCalled();
    expect(runCommand).not.toHaveBeenCalled();
  });
});
