import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveBaseDirFromRecord,
  resolvePluginToolIds,
  resolveScopeForInstall,
} from "../../../../../src/contexts/installation/application/plugin/plugin-target-resolution.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { UnresolvableUserScopeError } from "../../../../../src/shared/domain/errors.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";

const { cursor } = TOOL;

const HOME = "/home/u";
const homedir = () => HOME;

describe("resolvePluginToolIds()", () => {
  it("resolves 'all' to the AI tools the manifest holds, in registry order", () => {
    const manifest = Manifest.create();
    manifest.addTool(cursor, "1.0.0", []);
    manifest.addTool(TOOL.claude, "1.0.0", []);

    expect(resolvePluginToolIds("all", manifest, registeredTools())).toStrictEqual([
      "claude",
      "cursor",
    ]);
  });
});

describe("resolveScopeForInstall()", () => {
  it("reads the scope a fresh install writes from the tool's own profile", () => {
    expect(resolveScopeForInstall(registeredTools().aiProfile(cursor))).toBe("user");
    expect(resolveScopeForInstall(registeredTools().aiProfile(TOOL.claude))).toBe("project");
  });
});

describe("resolveBaseDirFromRecord() — the manifest's recorded scope, not the profile", () => {
  it("resolves project scope to projectRoot regardless of what the tool's profile says", () => {
    // cursor's own profile declares installScope "user", so a manifest entry recorded
    // scope: "project" must still resolve under projectRoot.
    const baseDir = resolveBaseDirFromRecord(
      "project",
      registeredTools().aiProfile(cursor),
      "/proj",
      homedir
    );
    expect(baseDir).toBe("/proj");
    expect(baseDir).not.toContain(join(".cursor", "plugins", "local"));
  });

  it("resolves user scope to the tool's user-scope plugins dir", () => {
    const baseDir = resolveBaseDirFromRecord(
      "user",
      registeredTools().aiProfile(cursor),
      "/proj",
      homedir
    );
    expect(baseDir).toBe(join(HOME, ".cursor", "plugins", "local"));
  });

  // A "user" scope the tool's current profile cannot explain must refuse to guess rather
  // than quietly resolve under projectRoot; claude declares no user-scope directory at all.
  it("throws, rather than falling back to projectRoot, when the tool declares no user-scope directory", () => {
    expect(() =>
      resolveBaseDirFromRecord("user", registeredTools().aiProfile(TOOL.claude), "/proj", homedir)
    ).toThrow(UnresolvableUserScopeError);
  });
});

describe("resolvePluginToolIds() order", () => {
  it("keeps the shared tool order, which puts codex after opencode and kilo", () => {
    const manifest = Manifest.create();
    for (const id of [TOOL.codex, TOOL.opencode, TOOL.kilo, TOOL.copilot]) {
      manifest.addTool(id, "1.0.0", []);
    }

    expect(resolvePluginToolIds("all", manifest, registeredTools())).toStrictEqual([
      "copilot",
      "opencode",
      "kilo",
      "codex",
    ]);
  });
});
