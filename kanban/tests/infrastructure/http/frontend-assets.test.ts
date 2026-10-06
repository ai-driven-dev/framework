import { describe, expect, it } from "vitest";
import { readFrontendAssets } from "../../../src/infrastructure/http/frontend-assets.js";

describe("frontend assets", () => {
  it("reads the real frontend assets when running from the sources", () => {
    const assets = readFrontendAssets();

    expect(assets.indexHtml).toContain("<!DOCTYPE html>");
    expect(assets.stylesCss.length).toBeGreaterThan(0);
    expect(assets.appJs).toContain("EventSource");
  });
});
