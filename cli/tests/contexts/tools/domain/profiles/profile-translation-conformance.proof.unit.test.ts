import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../../../../src/composition/tool-profiles.js";
import type { ToolBuildContract } from "../../../../../src/contexts/tools/contract/build-contract.js";
import type { McpConfigAnswers } from "../../../../../src/contexts/tools/contract/tool-profile.js";
import type { AiTool } from "../../../../../src/contexts/tools/domain/profile.js";
import type { ConformanceSubject } from "../../testing/profile-conformance.contract.js";
import { PROFILE_TRANSLATION_CHECKS } from "../../testing/profile-translation-conformance.contract.js";

/**
 * A conformance check that nothing fails is a comment. For each check, one profile broken in
 * exactly that one way: the check must fail on it, and every other check must still hold.
 */

function aiTool(toolId: string): AiTool {
  const found = REGISTERED_PROFILES.find((profile) => profile.toolId === toolId);
  if (found?.kind !== "ai") throw new Error(`${toolId} is no registered AI tool`);
  return found;
}

/** Between them, a flat tool with an mcp file, a tool merging hooks into the project's file and
 * a tool whose manifest has a schema: every check has a subject it does not skip. */
const FLAT = aiTool("opencode");
const HOOKED = aiTool("cursor");
const SCHEMED = aiTool("codex");

function subjectOf(profile: AiTool): ConformanceSubject {
  return { profile, registration: REGISTERED_PROFILES };
}

function flatPathIgnoring(profile: AiTool, name: (pluginName: string) => string): AiTool {
  return {
    ...profile,
    flatInstallPath: (section, pluginName, fileName) =>
      profile.flatInstallPath(section, name(pluginName), fileName),
  };
}

function withManifest(profile: AiTool, manifest: Record<string, unknown>): AiTool {
  const marketplace = (): ToolBuildContract => {
    const built = profile.buildContracts.marketplace?.();
    if (built === undefined) throw new Error(`${profile.toolId} builds no marketplace`);
    return { ...built, synthesizeManifest: () => manifest };
  };
  return { ...profile, buildContracts: { ...profile.buildContracts, marketplace } };
}

function withMcpMergeForgetting(profile: AiTool): AiTool {
  const mcp = profile.flatPluginMcp();
  if (mcp === null) throw new Error(`${profile.toolId} merges no plugin mcp`);
  const merge: McpConfigAnswers["mergePluginServers"] = (_existing, incoming, previous) =>
    mcp.mergePluginServers(null, incoming, previous);
  const forgetting = new Proxy(mcp, {
    get: (target, key) =>
      key === "mergePluginServers" ? merge : Reflect.get(target, key).bind(target),
  });
  return { ...profile, flatPluginMcp: () => forgetting };
}

function withHooksMergeForgetting(profile: AiTool): AiTool {
  const location = profile.projectHooksDelivery();
  if (location === null) throw new Error(`${profile.toolId} merges no project hooks`);
  const { format } = location;
  const merge = (_existing: string | null, hooks: string, name: string) =>
    format.merge(null, hooks, name);
  return {
    ...profile,
    projectHooksDelivery: () => ({ ...location, format: { ...format, merge } }),
  };
}

function withRootToken(profile: AiTool, token: string): AiTool {
  const plugins = profile.plugins();
  if (plugins?.kind !== "native") throw new Error(`${profile.toolId} is not native`);
  return { ...profile, plugins: () => ({ ...plugins, rootToken: () => token }) };
}

let counter = 0;

/** What each check is fed so that it, and only it, has a case to fail. */
const BROKEN: Readonly<Record<string, () => ConformanceSubject>> = {
  "writes the same files for the same plugin, whatever order its files arrive in": () => {
    return subjectOf(flatPathIgnoring(FLAT, (name) => `${name}-${counter++}`));
  },
  "writes no path that two distinct plugins share": () =>
    subjectOf(flatPathIgnoring(FLAT, () => "shared")),
  "writes only JSON that parses": () => subjectOf(withRootToken(SCHEMED, '"')),
  "builds only manifests that name the plugin and its version": () =>
    subjectOf(withManifest(SCHEMED, {})),
  "keeps a person's mcp servers and keys when a plugin's are merged in, and again": () =>
    subjectOf(withMcpMergeForgetting(FLAT)),
  "keeps a person's hooks and keys when a plugin's are merged in, and removed again": () =>
    subjectOf(withHooksMergeForgetting(HOOKED)),
};

function failuresOf(subject: ConformanceSubject): string[] {
  return PROFILE_TRANSLATION_CHECKS.filter((check) => {
    try {
      check.holds(subject);
      return false;
    } catch {
      return true;
    }
  }).map((check) => check.title);
}

describe("the translation conformance checks, each against a profile broken for it alone", () => {
  it("passes every check on the profiles it is broken from", () => {
    for (const profile of [FLAT, HOOKED, SCHEMED]) {
      expect(failuresOf(subjectOf(profile))).toEqual([]);
    }
  });

  it("breaks every check", () => {
    expect(Object.keys(BROKEN).sort()).toEqual(
      PROFILE_TRANSLATION_CHECKS.map((c) => c.title).sort()
    );
  });

  it.each(PROFILE_TRANSLATION_CHECKS.map((check) => check.title))("%s", (title) => {
    expect(failuresOf(BROKEN[title]?.() ?? subjectOf(FLAT))).toEqual([title]);
  });
});
