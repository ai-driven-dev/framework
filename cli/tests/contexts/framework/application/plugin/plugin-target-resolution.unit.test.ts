import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  frameworkPrimeFlatMcpOf,
  resolveBaseDirFromRecord,
  resolvePluginToolIds,
  resolveScopeForInstall,
} from "../../../../../src/contexts/framework/application/plugin/plugin-target-resolution.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { mcpCapabilityOf } from "../../../../../src/contexts/tools/domain/registry.js";
import { UnresolvableUserScopeError } from "../../../../../src/kernel/errors.js";
import { registeredAiProfile } from "../../../tools/testing/catalog-of.js";

const HOME = "/home/u";
const homedir = () => HOME;

describe("resolvePluginToolIds()", () => {
  it("resolves 'all' to the AI tools the manifest holds, in registry order", () => {
    const manifest = Manifest.create();
    manifest.addTool("cursor", "1.0.0", []);
    manifest.addTool("claude", "1.0.0", []);

    expect(resolvePluginToolIds("all", manifest)).toStrictEqual(["claude", "cursor"]);
  });
});

describe("frameworkPrimeFlatMcpOf()", () => {
  it("answers the MCP capability of a flat tool merging framework-prime", () => {
    expect(frameworkPrimeFlatMcpOf(registeredAiProfile("opencode"))).toBe(
      mcpCapabilityOf("opencode")
    );
    expect(frameworkPrimeFlatMcpOf(registeredAiProfile("kilo"))).toBe(mcpCapabilityOf("kilo"));
  });

  it("answers null for a native tool merging framework-prime", () => {
    expect(frameworkPrimeFlatMcpOf(registeredAiProfile("copilot"))).toBeNull();
  });

  it("answers null for a tool whose MCP does not merge framework-prime", () => {
    expect(frameworkPrimeFlatMcpOf(registeredAiProfile("claude"))).toBeNull();
  });
});

describe("resolveScopeForInstall()", () => {
  it("reads the scope a fresh install writes from the tool's own profile", () => {
    expect(resolveScopeForInstall(registeredAiProfile("cursor"))).toBe("user");
    expect(resolveScopeForInstall(registeredAiProfile("claude"))).toBe("project");
  });
});

describe("resolveBaseDirFromRecord() — the manifest's recorded scope, not the profile", () => {
  it("resolves project scope to projectRoot regardless of what the tool's profile says", () => {
    // cursor's own profile declares installScope "user", so a manifest entry recorded
    // scope: "project" must still resolve under projectRoot.
    const baseDir = resolveBaseDirFromRecord(
      "project",
      registeredAiProfile("cursor"),
      "/proj",
      homedir
    );
    expect(baseDir).toBe("/proj");
    expect(baseDir).not.toContain(join(".cursor", "plugins", "local"));
  });

  it("resolves user scope to the tool's user-scope plugins dir", () => {
    const baseDir = resolveBaseDirFromRecord(
      "user",
      registeredAiProfile("cursor"),
      "/proj",
      homedir
    );
    expect(baseDir).toBe(join(HOME, ".cursor", "plugins", "local"));
  });

  // A "user" scope the tool's current profile cannot explain must refuse to guess rather
  // than quietly resolve under projectRoot; claude declares no user-scope directory at all.
  it("throws, rather than falling back to projectRoot, when the tool declares no user-scope directory", () => {
    expect(() =>
      resolveBaseDirFromRecord("user", registeredAiProfile("claude"), "/proj", homedir)
    ).toThrow(UnresolvableUserScopeError);
  });
});
