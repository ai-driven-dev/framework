import { describe, expect, it } from "vitest";
import { CurrentVersionAdapter } from "../../../src/infrastructure/adapters/current-version-adapter.js";

describe("CurrentVersionAdapter", () => {
  it("returns the bundled package version", () => {
    const adapter = new CurrentVersionAdapter();
    expect(adapter.get()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
