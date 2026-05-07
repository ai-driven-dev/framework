import { describe, expect, it, vi } from "vitest";
import { InputRequiredError } from "../../../../src/application/errors.js";
import { McpUseCase } from "../../../../src/application/use-cases/shared/mcp-use-case.js";
import type { Prompter } from "../../../../src/domain/ports/prompter.js";
import { KeepPrompter } from "../helpers.js";

describe("McpUseCase", () => {
  describe("no keys", () => {
    it("returns empty Set regardless of other options", async () => {
      const uc = new McpUseCase();
      const result = await uc.execute({
        keys: [],
        defaultChecked: true,
        message: "Select",
        interactive: true,
      });
      expect(result.size).toBe(0);
    });
  });

  describe("mcpFilter", () => {
    it("validates and returns filtered set", async () => {
      const uc = new McpUseCase();
      const result = await uc.execute({
        keys: ["a", "b", "c"],
        defaultChecked: false,
        message: "Select",
        mcpFilter: ["a", "b"],
        interactive: false,
      });
      expect([...result].sort()).toEqual(["a", "b"]);
    });

    it("throws InputRequiredError for unknown filter key", async () => {
      const uc = new McpUseCase();
      const promise = uc.execute({
        keys: ["a"],
        defaultChecked: false,
        message: "Select",
        mcpFilter: ["unknown"],
        interactive: false,
      });
      await expect(promise).rejects.toBeInstanceOf(InputRequiredError);
      await expect(
        uc.execute({
          keys: ["a"],
          defaultChecked: false,
          message: "Select",
          mcpFilter: ["unknown"],
          interactive: false,
        })
      ).rejects.toThrow(/unknown/i);
    });
  });

  describe("interactive mode", () => {
    it("fires checkbox with all choices unchecked in install mode (defaultChecked=false)", async () => {
      const checkboxMock = vi.fn().mockResolvedValue(["a"]);
      const mockPrompter = Object.create(new KeepPrompter()) as Prompter;
      mockPrompter.checkbox = checkboxMock;

      const uc = new McpUseCase(mockPrompter);
      const result = await uc.execute({
        keys: ["a", "b"],
        defaultChecked: false,
        message: "Which MCP servers?",
        interactive: true,
      });

      expect(checkboxMock).toHaveBeenCalledTimes(1);
      expect(checkboxMock).toHaveBeenCalledWith(
        "Which MCP servers?",
        expect.arrayContaining([
          expect.objectContaining({ name: "a", value: "a", checked: false }),
          expect.objectContaining({ name: "b", value: "b", checked: false }),
        ])
      );
      expect([...result]).toEqual(["a"]);
    });

    it("fires checkbox with all choices checked in update mode (defaultChecked=true)", async () => {
      const checkboxMock = vi.fn().mockResolvedValue(["a"]);
      const mockPrompter = Object.create(new KeepPrompter()) as Prompter;
      mockPrompter.checkbox = checkboxMock;

      const uc = new McpUseCase(mockPrompter);
      const result = await uc.execute({
        keys: ["a", "b"],
        defaultChecked: true,
        message: "Which MCP servers?",
        interactive: true,
      });

      expect(checkboxMock).toHaveBeenCalledTimes(1);
      expect(checkboxMock).toHaveBeenCalledWith(
        "Which MCP servers?",
        expect.arrayContaining([
          expect.objectContaining({ name: "a", value: "a", checked: true }),
          expect.objectContaining({ name: "b", value: "b", checked: true }),
        ])
      );
      expect([...result]).toEqual(["a"]);
    });
  });

  describe("non-interactive mode", () => {
    it("returns empty Set when defaultChecked is false", async () => {
      const uc = new McpUseCase();
      const result = await uc.execute({
        keys: ["a", "b"],
        defaultChecked: false,
        message: "Select",
        interactive: false,
      });
      expect(result.size).toBe(0);
    });

    it("returns full Set of all keys when defaultChecked is true", async () => {
      const uc = new McpUseCase();
      const result = await uc.execute({
        keys: ["a", "b"],
        defaultChecked: true,
        message: "Select",
        interactive: false,
      });
      expect([...result].sort()).toEqual(["a", "b"]);
    });
  });

  describe("no prompter with interactive flag", () => {
    it("falls through to default branch and returns full Set when defaultChecked is true", async () => {
      const uc = new McpUseCase();
      const result = await uc.execute({
        keys: ["a", "b"],
        defaultChecked: true,
        message: "Select",
        interactive: true,
      });
      expect([...result].sort()).toEqual(["a", "b"]);
    });
  });
});
