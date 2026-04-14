import { describe, expect, it, vi } from "vitest";
import { McpUseCase } from "../../../../src/application/use-cases/shared/mcp-use-case.js";
import type { Prompter } from "../../../../src/domain/ports/prompter.js";

function makeAvailable(servers: string[]): Map<string, string[]> {
  return new Map([[".mcp.json", servers]]);
}

function makePrompter(selected: string[]): Prompter {
  return {
    checkbox: vi.fn().mockResolvedValue(selected),
    resolveConflict: vi.fn(),
    confirm: vi.fn(),
    input: vi.fn(),
    select: vi.fn(),
  } as unknown as Prompter;
}

describe("McpUseCase", () => {
  const available = makeAvailable(["github", "playwright"]);

  describe("explicit mcpFilter", () => {
    it("returns only the specified servers", async () => {
      const uc = new McpUseCase();
      const result = await uc.execute({ available, mcpFilter: ["github"], interactive: false });
      expect([...result]).toEqual(["github"]);
    });

    it("throws when a filter key does not exist in available servers", async () => {
      const uc = new McpUseCase();
      await expect(
        uc.execute({ available, mcpFilter: ["nonexistent"], interactive: false })
      ).rejects.toThrow("Unknown MCP server");
    });

    it("includes the available server list in the error message", async () => {
      const uc = new McpUseCase();
      await expect(
        uc.execute({ available, mcpFilter: ["nonexistent"], interactive: false })
      ).rejects.toThrow("github");
    });
  });

  describe("interactive mode (no mcpFilter)", () => {
    it("calls prompter.checkbox with all available keys pre-checked", async () => {
      const prompter = makePrompter(["playwright"]);
      const uc = new McpUseCase(prompter);
      const result = await uc.execute({ available, mcpFilter: [], interactive: true });
      expect(prompter.checkbox).toHaveBeenCalledOnce();
      expect([...result]).toEqual(["playwright"]);
    });

    it("returns all servers when prompter is absent in interactive mode", async () => {
      const uc = new McpUseCase();
      const result = await uc.execute({ available, mcpFilter: [], interactive: true });
      expect([...result]).toHaveLength(2);
    });
  });

  describe("non-interactive mode (no mcpFilter)", () => {
    it("returns all available servers without prompting", async () => {
      const prompter = makePrompter([]);
      const uc = new McpUseCase(prompter);
      const result = await uc.execute({ available, mcpFilter: [], interactive: false });
      expect(prompter.checkbox).not.toHaveBeenCalled();
      expect([...result]).toHaveLength(2);
    });
  });

  describe("no MCP content", () => {
    it("returns an empty set when available is empty", async () => {
      const uc = new McpUseCase();
      const result = await uc.execute({ available: new Map(), mcpFilter: [], interactive: false });
      expect(result.size).toBe(0);
    });
  });
});
