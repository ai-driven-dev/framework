import { describe, expect, it } from "vitest";
import {
  cacheWrites,
  messageIterations,
} from "../../../../src/contexts/telemetry/domain/claude-usage-iterations.js";

describe("the iterations of a message", () => {
  it("are none when the usage lists none", () => {
    const notes: string[] = [];
    expect(messageIterations({}, notes)).toEqual([]);
    expect(notes).toEqual([]);
  });

  it("keep the objects of a list and note each entry that is not one", () => {
    const notes: string[] = [];
    expect(messageIterations({ iterations: [{ type: "message" }, 3] }, notes)).toEqual([
      { type: "message" },
    ]);
    expect(notes).toEqual(["usage.iterations holds a non-object"]);
  });

  it("note a value that is not a list", () => {
    const notes: string[] = [];
    expect(messageIterations({ iterations: "x" }, notes)).toEqual([]);
    expect(notes).toEqual(["usage.iterations is not a list"]);
  });
});

describe("the cache writes of a message", () => {
  it("are read from the usage when no iteration is a message", () => {
    const usage = {
      cache_creation_input_tokens: 5,
      cache_creation: { ephemeral_1h_input_tokens: 2 },
    };
    expect(cacheWrites(usage, [{ type: "advisor_message" }], [])).toEqual({
      total: 5,
      oneHour: 2,
    });
  });

  it("are summed over every message iteration", () => {
    const iterations = [
      {
        type: "message",
        cache_creation_input_tokens: 3,
        cache_creation: { ephemeral_1h_input_tokens: 1 },
      },
      {
        type: "message",
        cache_creation_input_tokens: 4,
        cache_creation: { ephemeral_1h_input_tokens: 2 },
      },
    ];
    expect(cacheWrites({}, iterations, [])).toEqual({ total: 7, oneHour: 3 });
  });

  it("are unknown when one part lacks the count", () => {
    const iterations = [{ type: "message", cache_creation_input_tokens: 3 }, { type: "message" }];
    expect(cacheWrites({}, iterations, [])).toEqual({ total: null, oneHour: null });
  });
});
