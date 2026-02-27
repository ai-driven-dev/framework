import { describe, expect, it } from "vitest";
import { Settings } from "../../../src/domain/models/settings.js";

describe("Settings", () => {
  it("uses defaults when no values provided", () => {
    const settings = new Settings();
    expect(settings.repo).toBe("ai-driven-dev/aidd-framework");
    expect(settings.docsDir).toBe("aidd_docs");
    expect(settings.verbose).toBe(false);
  });

  it("uses defaults when empty object provided", () => {
    const settings = new Settings({});
    expect(settings.repo).toBe("ai-driven-dev/aidd-framework");
    expect(settings.docsDir).toBe("aidd_docs");
    expect(settings.verbose).toBe(false);
  });

  it("overrides repo when provided", () => {
    const settings = new Settings({ repo: "my-org/my-repo" });
    expect(settings.repo).toBe("my-org/my-repo");
    expect(settings.docsDir).toBe("aidd_docs");
    expect(settings.verbose).toBe(false);
  });

  it("overrides docsDir when provided", () => {
    const settings = new Settings({ docsDir: "custom_docs" });
    expect(settings.docsDir).toBe("custom_docs");
  });

  it("overrides verbose when provided", () => {
    const settings = new Settings({ verbose: true });
    expect(settings.verbose).toBe(true);
  });

  it("overrides all values when all provided", () => {
    const settings = new Settings({
      repo: "org/repo",
      docsDir: "docs",
      verbose: true,
    });
    expect(settings.repo).toBe("org/repo");
    expect(settings.docsDir).toBe("docs");
    expect(settings.verbose).toBe(true);
  });
});
