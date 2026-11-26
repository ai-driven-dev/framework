/**
 * The CLI ships with a small, closed set of runtime dependencies. The cap is the count today:
 * a new one is a decision made by raising it here, in review, and never by an install alone.
 */
import { describe, expect, it } from "vitest";
import { parseJsonRecord } from "../shared/testing/json-value.builder.js";
import { read } from "./source-graph.js";

const RUNTIME_DEPENDENCY_CAP = 7;

describe("runtime dependencies", () => {
  it("holds package.json to the cap", () => {
    const { dependencies } = parseJsonRecord(read("package.json"));

    expect(Object.keys(dependencies ?? {}).length).toBeLessThanOrEqual(RUNTIME_DEPENDENCY_CAP);
  });
});
