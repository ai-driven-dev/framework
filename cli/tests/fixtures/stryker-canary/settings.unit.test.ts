import { describe, expect, it } from "vitest";
import { readDirectory, readLiteralDirectory, readSiblingDirectory, SETTINGS } from "./settings.js";

it("reads the directory the settings declare", () => {
  expect(SETTINGS).toStrictEqual({ directory: ".cursor/" });
});

describe("a", () => {
  describe("b", () => {
    it("c", () => {
      expect(readSiblingDirectory()).toBe(".cursor/");
    });
  });
});

describe("a b", () => {
  it("c", () => {
    expect(readDirectory()).toBe(".cursor/");
  });
});

describe("a  suite [regex].*", () => {
  it("literal  test (x)+", () => {
    expect(readLiteralDirectory()).toBe(".cursor/");
  });
});
