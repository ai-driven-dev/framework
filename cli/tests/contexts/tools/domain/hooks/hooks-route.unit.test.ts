import { describe, expect, it } from "vitest";
import type { HooksFileFormat } from "../../../../../src/contexts/tools/domain/hooks/hooks-entry-shape.js";
import { routeEvents } from "../../../../../src/contexts/tools/domain/hooks/hooks-route.js";

const FLAT: HooksFileFormat = {
  wrapper: {},
  entries: { shape: "flat", fieldsKept: ["command"] },
};
const GROUPS = [{ hooks: [{ command: "a" }] }];

describe("routing a plugin's events to a tool's", () => {
  it("sends an event to the name the tool fires it under and names one it never fires", () => {
    expect(
      routeEvents(
        [
          ["Start", GROUPS],
          ["Pre", GROUPS],
        ],
        { Start: "begin" },
        FLAT
      )
    ).toStrictEqual({ routed: [["begin", [{ command: "a" }]]], skipped: ["Pre"] });
  });

  it("keeps every event under its own name for a tool with no event map", () => {
    expect(routeEvents([["Stop", GROUPS]], undefined, FLAT)).toStrictEqual({
      routed: [["Stop", [{ command: "a" }]]],
      skipped: [],
    });
  });

  it("names an event that is only a key every object inherits", () => {
    expect(routeEvents([["constructor", GROUPS]], { Start: "begin" }, FLAT)).toStrictEqual({
      routed: [],
      skipped: ["constructor"],
    });
  });
});
