import { describe, expect, it } from "vitest";
import {
  parseRepositoryAliases,
  renderRepositoryAliases,
} from "../../../../../src/contexts/telemetry/domain/legacy/repository-aliases.js";

describe("the table of ids an earlier version gave repositories", () => {
  it("reads back what it wrote, its ids in text order", () => {
    const ids = new Map([
      ["b", "y"],
      ["a", "x"],
    ]);
    const text = renderRepositoryAliases({ ids, complete: false, pending: ["/w/b", "/w/a"] });
    expect(text).toBe(
      `${JSON.stringify({ version: 1, complete: false, aliases: { a: "x", b: "y" }, pending: ["/w/a", "/w/b"] }, null, 2)}\n`
    );
    expect(parseRepositoryAliases(text)).toEqual({
      ids,
      complete: false,
      pending: ["/w/a", "/w/b"],
    });
  });

  it.each([
    ["missing", null],
    ["not JSON", "{"],
    [
      "another format, all else valid",
      JSON.stringify({ version: 2, complete: true, aliases: {}, pending: [] }),
    ],
    [
      "a completion that is no boolean, all else valid",
      JSON.stringify({ version: 1, complete: "yes", aliases: {}, pending: [] }),
    ],
    [
      "no table, all else valid",
      JSON.stringify({ version: 1, complete: true, aliases: null, pending: [] }),
    ],
    ["no completion", JSON.stringify({ version: 1, aliases: {} })],
    ["a completion that is no boolean", JSON.stringify({ version: 1, complete: 1, aliases: {} })],
    ["no table", JSON.stringify({ version: 1, complete: true })],
    [
      "an id that is no text",
      JSON.stringify({ version: 1, complete: true, aliases: { a: 1 }, pending: [] }),
    ],
    ["no pending roots", JSON.stringify({ version: 1, complete: true, aliases: {} })],
    [
      "a pending root that is no text",
      JSON.stringify({ version: 1, complete: true, aliases: {}, pending: [1] }),
    ],
    [
      "an empty id",
      JSON.stringify({ version: 1, complete: true, aliases: { a: "x", b: "" }, pending: [] }),
    ],
  ])("is none when %s, so it is made again", (_name, text) => {
    expect(parseRepositoryAliases(text)).toBeNull();
  });
});
