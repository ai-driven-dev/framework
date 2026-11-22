import { expect, it } from "vitest";
import {
  asComponentPathMap,
  asMcpDigestMap,
  asPathHashMap,
} from "../../../../../src/contexts/installation/domain/plugins/plugin-entry.js";

it("brands a map without copying it", () => {
  const map = new Map([["a", "b"]]);
  expect(asPathHashMap(map)).toBe(map);
  expect(asComponentPathMap(map)).toBe(map);
  expect(asMcpDigestMap(map)).toBe(map);
});
