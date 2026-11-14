import { describe, expect, it } from "vitest";
import { parseRepositoryAliases } from "../../../../../src/contexts/telemetry/domain/legacy/repository-aliases.js";

describe("the table of ids an earlier version gave repositories", () => {
  it("reads the ids an earlier version wrote", () => {
    const text = JSON.stringify({ version: 1, aliases: { a: "x" } });
    expect(parseRepositoryAliases(text)).toEqual(new Map([["a", "x"]]));
  });

  it.each([
    ["missing", null],
    ["not JSON", "{"],
    ["another format, all else valid", JSON.stringify({ version: 2, aliases: {} })],
    ["no table", JSON.stringify({ version: 1 })],
    ["an id that is no text", JSON.stringify({ version: 1, aliases: { a: 1 } })],
    ["an empty id", JSON.stringify({ version: 1, aliases: { a: "x", b: "" } })],
  ])("is none when %s", (_name, text) => {
    expect(parseRepositoryAliases(text)).toBeNull();
  });
});
