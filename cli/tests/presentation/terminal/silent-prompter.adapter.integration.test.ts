import { describe, expect, it } from "vitest";
import { SilentPrompterAdapter } from "../../../src/presentation/terminal/silent-prompter.adapter.js";
import { saying } from "../../shared/testing/saying.builder.js";

describe("SilentPrompterAdapter", () => {
  const adapter = new SilentPrompterAdapter();

  describe("confirm()", () => {
    it("always returns true", async () => {
      expect(await adapter.confirm("Are you sure?")).toBe(true);
    });
  });

  describe("input()", () => {
    it("returns empty string when no default provided", async () => {
      expect(await adapter.input("Enter value:")).toBe("");
    });

    it("returns the default value when provided", async () => {
      expect(await adapter.input("Enter value:", "hello")).toBe("hello");
    });
  });

  describe("select()", () => {
    it("returns the first non-disabled choice value", async () => {
      const result = await adapter.select("Pick one:", [
        { name: "A", value: "a" },
        { name: "B", value: "b", disabled: true },
      ]);
      expect(result).toBe("a");
    });

    it("skips disabled choices and returns first enabled", async () => {
      const result = await adapter.select("Pick one:", [
        { name: "X", value: "x", disabled: true },
        { name: "Y", value: "y" },
        { name: "Z", value: "z" },
      ]);
      expect(result).toBe("y");
    });

    it("throws when all choices are disabled", async () => {
      await expect(
        adapter.select("Pick one:", [{ name: "A", value: "a", disabled: true }])
      ).rejects.toThrow(saying("No enabled choices available"));
    });
  });

  describe("checkbox()", () => {
    it("returns checked and non-disabled choices", async () => {
      const result = await adapter.checkbox("Pick:", [
        { name: "A", value: "a", checked: true },
        { name: "B", value: "b" },
        { name: "C", value: "c", checked: true, disabled: true },
      ]);
      expect(result).toEqual(["a"]);
    });

    it("returns empty array when no choices are checked", async () => {
      const result = await adapter.checkbox("Pick:", [
        { name: "A", value: "a" },
        { name: "B", value: "b" },
      ]);
      expect(result).toEqual([]);
    });

    it("excludes disabled choices even when checked", async () => {
      const result = await adapter.checkbox("Pick:", [
        { name: "A", value: "a", checked: true, disabled: true },
        { name: "B", value: "b", checked: true },
      ]);
      expect(result).toEqual(["b"]);
    });
  });
});
