import { describe, expect, it } from "vitest";
import { SilentPrompterAdapter } from "../../../src/infrastructure/adapters/silent-prompter-adapter.js";

describe("SilentPrompterAdapter", () => {
  const prompter = new SilentPrompterAdapter();

  describe("confirm()", () => {
    it("always returns true", async () => {
      expect(await prompter.confirm("Are you sure?")).toBe(true);
    });
  });

  describe("select()", () => {
    it("returns the first choice value", async () => {
      const result = await prompter.select("Pick one:", [
        { value: "first", label: "First" },
        { value: "second", label: "Second" },
      ]);
      expect(result).toBe("first");
    });

    it("throws when choices are empty", async () => {
      await expect(prompter.select("Pick:", [])).rejects.toThrow(
        "SilentPrompterAdapter.select called with empty choices"
      );
    });
  });

  describe("checkbox()", () => {
    it("returns all choice values", async () => {
      const result = await prompter.checkbox("Pick all:", [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
        { value: "c", label: "C" },
      ]);
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("returns empty array for empty choices", async () => {
      const result = await prompter.checkbox("Pick:", []);
      expect(result).toEqual([]);
    });
  });
});
