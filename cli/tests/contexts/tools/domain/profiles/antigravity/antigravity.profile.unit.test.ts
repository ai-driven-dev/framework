import { describe, expect, it } from "vitest";
import { PROFILE_SECTION_KEYS } from "../../../../../../src/contexts/tools/domain/profile.js";
import { antigravity } from "../../../../../../src/contexts/tools/domain/profiles/antigravity/antigravity.profile.js";
import { flatOf } from "../../../testing/plugin-mode.builder.js";

describe("antigravity", () => {
  it("is named for the person reading it and declares a flat build only", () => {
    expect(antigravity.displayName).toBe("Antigravity CLI");
    expect(antigravity.directory).toBe(".agents/");
    expect(antigravity.buildContracts?.flat).toBeDefined();
    expect(antigravity.buildContracts?.marketplace).toBeUndefined();
    expect([
      antigravity.distributionPaths("manifest"),
      antigravity.distributionPaths("marketplace"),
    ]).toStrictEqual([[], []]);
  });

  it("is a flat host merging plugin hooks into .agents/hooks.json, scripts under .agents/hooks/", () => {
    const plugins = flatOf(antigravity.plugins());
    expect({
      mode: plugins.kind,
      flatLayout: plugins.flatLayout(),
      acceptsHooks: plugins.hooksAcceptance().accepts,
      deliversHooksToProject: plugins.deliversHooksToProject(),
      projectHooksRelativePath: antigravity.projectHooksDelivery()?.relativePath,
    }).toMatchObject({
      mode: "flat",
      flatLayout: {
        namespacePrefix: "aidd-",
        skillLayout: "single-level",
      },
      acceptsHooks: true,
      deliversHooksToProject: true,
      projectHooksRelativePath: ".agents/hooks.json",
    });
    expect(PROFILE_SECTION_KEYS.filter((key) => antigravity.section(key) !== null).sort()).toEqual([
      "hooks",
      "layout",
      "skills",
    ]);
  });
});
