import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolvePluginToolIds,
  resolveScopeForInstall,
  scopeBaseOf,
} from "../../../../../src/contexts/installation/application/plugin/plugin-target-resolution.js";
import { UnresolvableUserScopeError } from "../../../../../src/contexts/installation/domain/installation.error.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

const { cursor } = TOOL;

describe("resolving the tools a plugin command targets", () => {
  it("resolves 'all' to the AI tools the manifest holds, in registry order", () => {
    const manifest = aManifest().withTool(cursor, []).withTool(TOOL.claude, []).build();

    expect(resolvePluginToolIds("all", manifest, registeredTools())).toStrictEqual([
      "claude",
      "cursor",
    ]);
  });
});

describe("resolving the scope of a fresh install", () => {
  it("reads the scope a fresh install writes from the tool's own profile", () => {
    expect(resolveScopeForInstall(registeredTools().aiProfile(cursor))).toBe("user");
    expect(resolveScopeForInstall(registeredTools().aiProfile(TOOL.claude))).toBe("project");
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

describe("resolving the base directory of a recorded scope", () => {
  const home = "/home/u";
  const query = (scope: Scope) => ({
    scope,
    projectRoot: "/proj",
    homedir: () => home,
  });

  it("resolves a recorded project scope to the project root, whatever the tool's profile says", () => {
    expect(scopeBaseOf(registeredTools().aiProfile(cursor), query("project"))).toBe("/proj");
  });

  it("resolves a recorded user scope to the tool's user plugins directory", () => {
    expect(scopeBaseOf(registeredTools().aiProfile(cursor), query("user"))).toBe(
      join(home, ".cursor", "plugins", "local")
    );
  });

  it("reads the home directory only for a user scope", () => {
    const homedir = () => {
      throw new Error("home read");
    };
    expect(scopeBaseOf(registeredTools().aiProfile(cursor), { ...query("project"), homedir })).toBe(
      "/proj"
    );
  });

  it("refuses a user scope for a tool that declares no user directory", () => {
    expect(() => scopeBaseOf(registeredTools().aiProfile(TOOL.claude), query("user"))).toThrow(
      UnresolvableUserScopeError
    );
  });
});
