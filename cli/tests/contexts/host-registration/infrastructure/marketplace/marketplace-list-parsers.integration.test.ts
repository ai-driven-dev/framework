import { describe, expect, it } from "vitest";
import { marketplaceListContract } from "../../../../../src/contexts/host-registration/infrastructure/marketplace/marketplace-list-parsers.js";

function parse(layout: "marketplaces-with-source" | "name-source-rows", output: string) {
  const read = marketplaceListContract("host", {
    from: "list-command",
    args: ["list"],
    layout,
    hostLabel: "Host",
    unavailableMessage: "unavailable",
    unverifiedMessage: "unverified",
  }).parse;
  if (read === undefined) throw new Error("the contract names no parser");
  return read(output);
}

describe("reading a host's marketplace list by its declared layout", () => {
  describe("a list of rows that carry their own source", () => {
    it("proves the source a row names", () => {
      const sources = parse(
        "marketplaces-with-source",
        JSON.stringify({
          marketplaces: [
            { name: "m", root: "/r", marketplaceSource: { sourceType: "directory", source: "/s" } },
          ],
        })
      );

      expect(sources.get("m")).toEqual({
        kind: "effective-list",
        root: "/r",
        sourceType: "directory",
        source: "/s",
      });
    });

    it("names a row without a source but leaves it unproven", () => {
      const sources = parse(
        "marketplaces-with-source",
        JSON.stringify({ marketplaces: [{ name: "m", root: "/r" }] })
      );

      expect(sources.get("m")).toBeNull();
    });

    it.each([
      ["a shape that is not a list of marketplaces", "[]", "unexpected Host JSON shape"],
      [
        "a row with no root",
        JSON.stringify({ marketplaces: [{ name: "m" }] }),
        "ambiguous Host marketplace JSON row",
      ],
      [
        "a name listed twice",
        JSON.stringify({
          marketplaces: [
            { name: "m", root: "/a" },
            { name: "m", root: "/b" },
          ],
        }),
        "ambiguous Host marketplace JSON row",
      ],
      [
        "a source without its type",
        JSON.stringify({
          marketplaces: [{ name: "m", root: "/r", marketplaceSource: { source: "/s" } }],
        }),
        "unproven Host marketplace source shape",
      ],
    ])("refuses %s", (_case, output, message) => {
      expect(() => parse("marketplaces-with-source", output)).toThrow(message);
    });
  });

  describe("a list of name and source rows", () => {
    it("proves a local source and leaves any other one unproven", () => {
      const sources = parse(
        "name-source-rows",
        JSON.stringify([
          { name: "local", source: "Local: /srv/m" },
          { name: "remote", source: "GitHub: owner/repo" },
        ])
      );

      expect(sources.get("local")).toEqual({
        kind: "effective-list",
        root: "/srv/m",
        sourceType: "local",
        source: "/srv/m",
      });
      expect(sources.get("remote")).toBeNull();
    });

    it.each([
      ["a shape that is not a list", "{}", "unexpected Host JSON shape"],
      ["a row that is not an object", "[1]", "ambiguous Host JSON row"],
      [
        "a name listed twice",
        JSON.stringify([
          { name: "m", source: "Local: /a" },
          { name: "m", source: "Local: /b" },
        ]),
        "ambiguous Host marketplace JSON row",
      ],
    ])("refuses %s", (_case, output, message) => {
      expect(() => parse("name-source-rows", output)).toThrow(message);
    });
  });
});
