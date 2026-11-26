import { describe, expect, it } from "vitest";
import { hookEventsOf } from "../../../../src/shared/domain/reading/hook-events.js";

describe("reading the events a hooks file declares", () => {
  it.each(['{"hooks":[]}', "{}", "[]"])("gives none for %s", (json) => {
    expect(hookEventsOf(json)).toStrictEqual({});
  });
});
