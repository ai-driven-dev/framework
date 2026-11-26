import { describe, expect, it } from "vitest";
import { routeEvents } from "../../../../../src/contexts/tools/domain/hooks/hooks-route.js";

const GROUPS = [{ hooks: [{ command: "a" }] }];
const shape = (_groups: unknown, toolEvent: string) => `shaped for ${toolEvent}`;

describe("routing a plugin's events to a tool's", () => {
  it("shapes an event under the name the tool fires it and names one it never fires", () => {
    expect(
      routeEvents(
        [
          ["Start", GROUPS],
          ["Pre", GROUPS],
        ],
        { Start: "begin" },
        shape
      )
    ).toStrictEqual({ routed: [["begin", "shaped for begin"]], skipped: ["Pre"] });
  });

  it("keeps every event under its own name for a tool with no event map", () => {
    expect(routeEvents([["Stop", GROUPS]], undefined, shape)).toStrictEqual({
      routed: [["Stop", "shaped for Stop"]],
      skipped: [],
    });
  });

  it("names an event that is only a key every object inherits", () => {
    expect(routeEvents([["constructor", GROUPS]], { Start: "begin" }, shape)).toStrictEqual({
      routed: [],
      skipped: ["constructor"],
    });
  });
});
