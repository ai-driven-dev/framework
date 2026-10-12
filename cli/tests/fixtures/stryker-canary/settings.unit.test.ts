import { describe, expect, it } from "vitest";
import { readDirectory, SETTINGS } from "./settings.js";

it("reads the directory the settings declare", () => {
  expect(SETTINGS).toStrictEqual({ directory: ".cursor/" });
});

describe("a mutant with a filtered test name", () => {
  it("runs the test inside its suite", () => {
    expect(readDirectory()).toBe(".cursor/");
  });
});
