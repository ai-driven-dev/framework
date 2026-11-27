import { describe, expect, it } from "vitest";
import { routeEvents } from "../../../../../src/contexts/tools/domain/hooks/hooks-route.js";

const GROUPS = [{ hooks: [{ command: "a" }] }];
const shape = (_groups: unknown, toolEvent: string) => `shaped for ${toolEvent}`;

describe("routing a plugin's events to a tool's", () => {
  it("names an event that is only a key every object inherits", () => {
    expect(routeEvents([["constructor", GROUPS]], { Start: ["begin"] }, shape)).toStrictEqual({
      routed: [],
      skipped: ["constructor"],
    });
  });
});
