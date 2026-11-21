import { describe, expect, it } from "vitest";
import pkg from "../../../package.json" with { type: "json" };
import { CurrentVersionAdapter } from "../../../src/shared/infrastructure/current-version-adapter.js";

describe("CurrentVersionAdapter", () => {
  it("returns the bundled package version", () => {
    expect(new CurrentVersionAdapter().get()).toBe(pkg.version);
  });
});
