import { describe, expect, it } from "vitest";
import { sharedMarketplaceKey } from "../../../../src/contexts/tools/domain/marketplace-entry.js";
import type { PluginSource } from "../../../../src/shared/domain/source.js";

const keyOf = (source: PluginSource): string | null =>
  sharedMarketplaceKey({ name: "aidd", source });

describe("sharedMarketplaceKey", () => {
  it.each<PluginSource>([
    { kind: "local", path: "/marketplace" },
    { kind: "github", repo: "owner/repo" },
  ])("keys a $kind marketplace by its name", (source) => {
    expect(keyOf(source)).toBe("aidd");
  });

  it.each<PluginSource>([
    { kind: "url", url: "https://example.test/m.git" },
    { kind: "git-subdir", url: "https://example.test/m.git", path: "m" },
    { kind: "npm", package: "m" },
  ])("gives a $kind marketplace no key, the tool cannot resolve it", (source) => {
    expect(keyOf(source)).toBeNull();
  });
});
