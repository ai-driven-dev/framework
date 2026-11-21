import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../../../../src/composition/tool-profiles.js";
import type {
  ArtifactContract,
  ToolBuildContract,
} from "../../../../../src/contexts/tools/contract/build-contract.js";
import type {
  FlatPluginAnswers,
  McpConfigAnswers,
  NativePluginAnswers,
  SettingsFileAnswers,
} from "../../../../../src/contexts/tools/contract/tool-profile.js";
import type {
  AiTool,
  ProfileSection,
  ProfileSectionKey,
  ProfileSections,
} from "../../../../../src/contexts/tools/domain/profile.js";
import { CommandsSection } from "../../../../../src/contexts/tools/domain/sections/commands-section.js";
import { McpConfigPart } from "../../../../../src/contexts/tools/domain/sections/mcp-section.js";
import {
  type ConformanceCheck,
  PROFILE_CHECKS,
} from "../../testing/profile-conformance.contract.js";
import {
  type FileConformanceSubject,
  PROFILE_FILE_CHECKS,
} from "../../testing/profile-file-conformance.contract.js";
import { PROFILE_TRANSLATION_CHECKS } from "../../testing/profile-translation-conformance.contract.js";

/**
 * A conformance check that nothing fails is a comment. For each check, one subject broken in
 * exactly that one way: the check must fail on it, and every other check must still hold.
 */

const ALL_CHECKS: readonly ConformanceCheck<FileConformanceSubject>[] = [
  ...PROFILE_CHECKS,
  ...PROFILE_FILE_CHECKS,
  ...PROFILE_TRANSLATION_CHECKS,
];

function aiTool(toolId: string): AiTool {
  const found = REGISTERED_PROFILES.find((profile) => profile.toolId === toolId);
  if (found?.kind !== "ai") throw new Error(`${toolId} is no registered AI tool`);
  return found;
}

/** The native tool and the flat tool that ships a hooks bridge: between them every check has a
 * subject it does not skip. */
const NATIVE = aiTool("claude");
const FLAT = aiTool("opencode");
const HOOKED = aiTool("cursor");
const SCHEMED = aiTool("codex");

/** One captured payload per native event the tool declares: what the repository's fixtures hold. */
function capturedPayloadsOf(profile: AiTool): string[] {
  return [...(profile.hooks?.events.values() ?? [])].flatMap((route) =>
    route.native.map((native) => `${profile.toolId}-${native}.json`)
  );
}

function subjectOf(
  profile: AiTool,
  broken: Partial<FileConformanceSubject> = {}
): FileConformanceSubject {
  return {
    profile,
    registration: REGISTERED_PROFILES,
    profileFolders: REGISTERED_PROFILES.map((registered) => registered.toolId),
    hooks: profile.hooks,
    payloadFixtures: capturedPayloadsOf(profile),
    ...broken,
  };
}

function native(profile: AiTool): NativePluginAnswers {
  const plugins = profile.plugins();
  if (plugins?.kind !== "native") throw new Error(`${profile.toolId} is not native`);
  return plugins;
}

function flat(profile: AiTool): FlatPluginAnswers {
  const plugins = profile.plugins();
  if (plugins?.kind !== "flat") throw new Error(`${profile.toolId} is not flat`);
  return plugins;
}

function marketplaceOf(profile: AiTool): ToolBuildContract {
  const contract = profile.buildContracts.marketplace?.();
  if (contract === undefined) throw new Error(`${profile.toolId} builds no marketplace`);
  return contract;
}

function flatBuildOf(profile: AiTool): ToolBuildContract {
  const contract = profile.buildContracts.flat?.();
  if (contract === undefined) throw new Error(`${profile.toolId} builds no flat tree`);
  return contract;
}

function commandsOf(profile: AiTool): ProfileSection<"commands"> {
  const commands = profile.section("commands");
  if (commands === null) throw new Error(`${profile.toolId} declares no commands`);
  return commands;
}

function withMarketplace(profile: AiTool, change: Partial<ToolBuildContract>): AiTool {
  const marketplace = (): ToolBuildContract => ({ ...marketplaceOf(profile), ...change });
  return { ...profile, buildContracts: { ...profile.buildContracts, marketplace } };
}

function withFlatBuild(profile: AiTool, change: Partial<ToolBuildContract>): AiTool {
  const built = (): ToolBuildContract => ({ ...flatBuildOf(profile), ...change });
  return { ...profile, buildContracts: { ...profile.buildContracts, flat: built } };
}

/** The profile, answering for the sections named and as before for the rest. */
function withSections(profile: AiTool, replaced: ProfileSections): AiTool {
  const section = <K extends ProfileSectionKey>(key: K): ProfileSection<K> | null =>
    replaced[key] ?? profile.section(key);
  return { ...profile, section };
}

const UNSUPPORTED: ArtifactContract = { supported: false };

function supported(path: () => string): ArtifactContract {
  return { supported: true, source: { kind: "configFile", srcPath: "x" }, path };
}

function convertedLike(profile: AiTool): CommandsSection["convertFrontmatter"] {
  return (fm, file) => commandsOf(profile).convertFrontmatter(fm, file);
}

function commandsWith(
  profile: AiTool,
  broken: {
    buildInstallPath?: (fileName: string) => string | null;
    convertFrontmatter?: CommandsSection["convertFrontmatter"];
  }
): CommandsSection {
  return new CommandsSection({
    toolSuffix: profile.toolSuffix,
    buildInstallPath: (fileName) => commandsOf(profile).buildInstallPath(fileName),
    convertFrontmatter: convertedLike(profile),
    ...broken,
  });
}

const REFUSES_EVERY_TOOL: SettingsFileAnswers = {
  consumes: () => false,
  consumedRefs: () => [],
  appliesWith: () => false,
  requires: () => false,
  writes: () => false,
  outputPath: () => ".settings.json",
  fileOf: () => {
    throw new Error("a proof subject writes nothing");
  },
  resolveStaticContent: () => null,
};

// biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a plugin ships
const OTHER_TOKEN = "${ANOTHER_PLUGIN_ROOT}";
const NOT_A_VARIABLE = "/opt/plugins";

function withBridgeGeneratingNothing(profile: AiTool): AiTool {
  const plugins = flat(profile);
  const layout = plugins.flatLayout();
  const bridge = layout.hooksBridge;
  if (bridge == null) throw new Error(`${profile.toolId} ships no hooks bridge`);
  const flatLayout = () => ({ ...layout, hooksBridge: { ...bridge, generate: () => null } });
  return { ...profile, plugins: () => ({ ...plugins, flatLayout }) };
}

function withoutEvent(profile: AiTool, event: string): FileConformanceSubject["hooks"] {
  const hooks = profile.hooks;
  if (hooks === undefined) throw new Error(`${profile.toolId} runs no hooks`);
  return { ...hooks, events: new Map([...hooks.events].filter(([name]) => name !== event)) };
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

let counter = 0;

/** What each check is fed so that it, and only it, has a case to fail. */
const BROKEN: Readonly<Record<string, () => FileConformanceSubject>> = {
  "is registered once, under its own id": () =>
    subjectOf(NATIVE, { registration: [...REGISTERED_PROFILES, NATIVE] }),
  "has a well-formed shape": () => subjectOf({ ...NATIVE, toolSuffix: "md" }),
  "computes every path relative, and keeps commands, rules, agents and flat hooks under its directory":
    () =>
      subjectOf(
        withSections(NATIVE, {
          commands: commandsWith(NATIVE, { buildInstallPath: () => "/x.md" }),
        })
      ),
  "builds neither rules nor commands from the plugin tree": () =>
    subjectOf(
      withMarketplace(NATIVE, {
        artifacts: { ...marketplaceOf(NATIVE).artifacts, rules: supported(() => "x.md") },
      })
    ),
  "gives every supported artifact a non-empty path": () =>
    subjectOf(
      withMarketplace(NATIVE, {
        artifacts: { ...marketplaceOf(NATIVE).artifacts, skills: supported(() => "") },
      })
    ),
  "is reachable by at least one build": () => subjectOf({ ...NATIVE, buildContracts: {} }),
  "is probed where it publishes a marketplace": () =>
    subjectOf({ ...NATIVE, distributionPaths: () => [] }),
  "lets its flat build carry hooks exactly when it accepts them": () =>
    subjectOf(
      withFlatBuild(FLAT, {
        artifacts: { ...flatBuildOf(FLAT).artifacts, hooks: UNSUPPORTED },
      })
    ),
  "names a variable, never a path": () =>
    subjectOf({
      ...withMarketplace(NATIVE, { pluginRootToken: NOT_A_VARIABLE }),
      plugins: () => ({ ...native(NATIVE), rootToken: () => NOT_A_VARIABLE }),
    }),
  "writes its own token into a marketplace build": () =>
    subjectOf(withMarketplace(NATIVE, { pluginRootToken: OTHER_TOKEN })),
  "writes no token into a flat build": () =>
    subjectOf(withFlatBuild(NATIVE, { pluginRootToken: OTHER_TOKEN })),
  "declares a plugins capability": () =>
    subjectOf({ ...NATIVE, plugins: () => null }, { hooks: undefined }),
  "feeds its mcp file from the mcp config": () =>
    subjectOf(
      withSections(NATIVE, {
        mcp: { config: new McpConfigPart({ format: "json", outputPath: ".mcp.json" }) },
      })
    ),
  "asks, in each settings file, for a registered tool": () =>
    subjectOf({ ...NATIVE, settingsFiles: () => [REFUSES_EVERY_TOOL] }),
  "routes a numbered command and its references to the same folder": () =>
    subjectOf({ ...NATIVE, linkSyntax: [] }),
  "names a numbered command after its phase and keeps only what it reads": () =>
    subjectOf(
      withSections(NATIVE, { commands: commandsWith(NATIVE, { convertFrontmatter: (fm) => fm }) })
    ),
  "sits in a profile folder the registration lists, and every folder is registered": () =>
    subjectOf(NATIVE, { profileFolders: ["codex"] }),
  "has a hooks descriptor exactly when it runs hooks": () =>
    subjectOf(NATIVE, { hooks: undefined }),
  "relays only events its descriptor declares": () =>
    subjectOf(NATIVE, { hooks: withoutEvent(NATIVE, "Stop") }),
  "generates a bridge for exactly the events it relays through one": () =>
    subjectOf(withBridgeGeneratingNothing(FLAT)),
  "comes with one captured payload per event it relays": () =>
    subjectOf(NATIVE, { payloadFixtures: [] }),
  "writes its files sorted by path, whatever order its files arrive in": () => {
    return subjectOf(flatPathIgnoring(FLAT, (name) => `${name}-${counter++}`));
  },
  "writes no path that two distinct plugins share": () =>
    subjectOf(flatPathIgnoring(FLAT, () => "shared")),
  "builds only manifests that name the plugin and its version": () =>
    subjectOf(withManifest(SCHEMED, {})),
  "keeps a person's mcp servers and keys when a plugin's are merged in, and again": () =>
    subjectOf(withMcpMergeForgetting(FLAT)),
  "keeps a person's hooks and keys when a plugin's are merged in, and removed again": () =>
    subjectOf(withHooksMergeForgetting(HOOKED)),
};

function failuresOf(subject: FileConformanceSubject): string[] {
  return ALL_CHECKS.filter((check) => {
    try {
      check.holds(subject);
      return false;
    } catch {
      return true;
    }
  }).map((check) => check.title);
}

describe("the profile conformance checks, each against a subject broken for it alone", () => {
  it("passes every check on the subjects it is broken from", () => {
    for (const profile of [NATIVE, FLAT, HOOKED, SCHEMED]) {
      expect(failuresOf(subjectOf(profile))).toEqual([]);
    }
  });

  it("breaks every check, and no check is broken twice", () => {
    expect(Object.keys(BROKEN).sort()).toEqual(ALL_CHECKS.map((check) => check.title).sort());
    expect(new Set(ALL_CHECKS.map((check) => check.title)).size).toBe(ALL_CHECKS.length);
  });

  it.each(ALL_CHECKS.map((check) => check.title))("%s", (title) => {
    expect(failuresOf(BROKEN[title]?.() ?? subjectOf(NATIVE))).toEqual([title]);
  });
});
