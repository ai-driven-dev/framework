import { expect, it } from "vitest";
import {
  asComponentPathMap,
  asMcpDigestMap,
  asPathHashMap,
  PLUGIN_NAME_REGEX,
} from "../../../../../src/contexts/installation/domain/plugins/plugin-entry.js";

it("brands a map without copying it", () => {
  const map = new Map([["a", "b"]]);
  expect(asPathHashMap(map)).toBe(map);
  expect(asComponentPathMap(map)).toBe(map);
  expect(asMcpDigestMap(map)).toBe(map);
});

it("accepts kebab-case names only", () => {
  expect(PLUGIN_NAME_REGEX.test("my-plugin-2")).toBe(true);
  expect(PLUGIN_NAME_REGEX.test("My_Plugin")).toBe(false);
});
