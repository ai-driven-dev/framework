import { expect, it } from "vitest";
import { isPluginName, parsePluginName } from "../../../../src/shared/domain/plugin/plugin-name.js";
import { InvalidPluginNameError } from "../../../../src/shared/domain/shared.error.js";

it("accepts kebab-case names only", () => {
  expect(isPluginName("my-plugin-2")).toBe(true);
  expect(isPluginName("My_Plugin")).toBe(false);
});

it("parses a kebab-case name and names the one it refuses", () => {
  expect(parsePluginName("aidd-dev")).toBe("aidd-dev");
  expect(() => parsePluginName("-bad")).toThrow(new InvalidPluginNameError("-bad"));
});
