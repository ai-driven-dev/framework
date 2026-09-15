import { describe, expect, it } from "vitest";
import { isMergeContentEmpty } from "../../src/kernel/merge.js";

describe("isMergeContentEmpty", () => {
  describe("at the top level", () => {
    it("is empty for an object with no keys", () => {
      expect(isMergeContentEmpty("{}", null)).toBe(true);
    });

    it("is not empty once any key remains", () => {
      expect(isMergeContentEmpty('{"a":1}', null)).toBe(false);
    });
  });

  describe("under a section key", () => {
    it("is empty when the section is the only key and holds nothing", () => {
      expect(isMergeContentEmpty('{"mcpServers":{}}', "mcpServers")).toBe(true);
    });

    it("is empty when the section is absent and nothing else is there", () => {
      expect(isMergeContentEmpty("{}", "mcpServers")).toBe(true);
    });

    it("is not empty when the section still holds an entry", () => {
      expect(isMergeContentEmpty('{"mcpServers":{"a":{}}}', "mcpServers")).toBe(false);
    });

    it("is not empty when another key sits beside the section", () => {
      expect(isMergeContentEmpty('{"mcpServers":{},"other":1}', "mcpServers")).toBe(false);
    });
  });

  it("is not empty when the content is not JSON", () => {
    expect(isMergeContentEmpty("not json", null)).toBe(false);
  });
});
