import { expect, it } from "vitest";
import { SETTINGS } from "./settings.js";

it("reads the directory the settings declare", () => {
  expect(SETTINGS).toStrictEqual({ directory: ".cursor/" });
});
