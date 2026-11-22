import { expect, it } from "vitest";
import { PLUGIN_NAME_REGEX } from "../../../../src/shared/domain/plugin/plugin-name.js";

it("accepts kebab-case names only", () => {
  expect(PLUGIN_NAME_REGEX.test("my-plugin-2")).toBe(true);
  expect(PLUGIN_NAME_REGEX.test("My_Plugin")).toBe(false);
});
