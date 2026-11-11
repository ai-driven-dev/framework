import { isAbsolute } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  ArtifactContract,
  ToolBuildContract,
} from "../../../../src/contexts/tools/domain/build-contract.js";
import { AgentsCapability } from "../../../../src/contexts/tools/domain/capabilities/agents-capability.js";
import { CommandsCapability } from "../../../../src/contexts/tools/domain/capabilities/commands-capability.js";
import { CONFIG_MCP } from "../../../../src/contexts/tools/domain/capabilities/config-refs.js";
import { McpCapability } from "../../../../src/contexts/tools/domain/capabilities/mcp-capability.js";
import { RulesCapability } from "../../../../src/contexts/tools/domain/capabilities/rules-capability.js";
import type { AiTool } from "../../../../src/contexts/tools/domain/contracts.js";
import { isProfileSectionKey } from "../../../../src/contexts/tools/domain/profile/profile-sections.js";
import { isAiTool, type ToolConfig } from "../../../../src/contexts/tools/domain/registry.js";
import { AI_TOOL_IDS, IDE_TOOL_IDS, type ToolId } from "../../../../src/kernel/tool.js";

/** What a conformance check is told about one profile and the registration it sits in. */
export interface ConformanceSubject {
  readonly profile: ToolConfig;
  readonly registration: readonly ToolConfig[];
}

/** A check is a pure assertion, so a proof can run it against a subject built to break it. */
export interface ConformanceCheck<S> {
  readonly title: string;
  readonly holds: (subject: S) => void;
}

/** The only place a capability is read from a profile whose capabilities are `unknown`. */
export function capability<T>(
  profile: AiTool,
  key: string,
  type: abstract new (...args: never[]) => T
): T | undefined {
  if (!isProfileSectionKey(key)) return undefined;
  const value: unknown = profile.section(key);
  return value instanceof type ? value : undefined;
}

const SAMPLE_PATHS: Readonly<Record<string, string>> = {
  skills: "aidd/SKILL.md",
  agents: "x.md",
  commands: "04_code/implement.md",
  rules: "x.md",
  mcp: ".mcp.json",
  hooks: "hooks/hooks.json",
};

const PLUGIN_ROOT_TOKEN = /^\$\{[A-Z_]+\}$/u;

function contractsOf(profile: AiTool): ToolBuildContract[] {
  const { marketplace, flat } = profile.buildContracts ?? {};
  return [marketplace?.(), flat?.()].filter((contract) => contract !== undefined);
}

function supportedArtifacts(
  contract: ToolBuildContract
): [string, Extract<ArtifactContract, { supported: true }>][] {
  return Object.entries(contract.artifacts).flatMap(([name, artifact]) =>
    artifact.supported ? [[name, artifact]] : []
  );
}

function aiCheck(
  title: string,
  holds: (profile: AiTool, subject: ConformanceSubject) => void
): ConformanceCheck<ConformanceSubject> {
  return {
    title,
    holds: (subject) => {
      if (isAiTool(subject.profile)) holds(subject.profile, subject);
    },
  };
}

function expectRelative(path: string, what: string): void {
  expect(isAbsolute(path) || path.split("/").includes(".."), `${what}: ${path}`).toBe(false);
}

function installedPaths(profile: AiTool): string[] {
  return [
    capability(profile, "commands", CommandsCapability)?.buildInstallPath(SAMPLE_PATHS.commands),
    capability(profile, "rules", RulesCapability)?.buildInstallPath(SAMPLE_PATHS.rules),
    capability(profile, "agents", AgentsCapability)?.buildInstallPath(SAMPLE_PATHS.agents),
  ].filter((path) => typeof path === "string");
}

function flatPathsUnderDirectory(contract: ToolBuildContract): string[] {
  const { agents, hooks } = contract.artifacts;
  return [
    agents.supported ? agents.path("plug", SAMPLE_PATHS.agents) : "",
    hooks.supported ? hooks.path("plug", SAMPLE_PATHS.hooks) : "",
    hooks.supported && hooks.hooksFile !== undefined ? hooks.hooksFile.path("plug") : "",
  ].filter((path) => path !== "");
}

const NUMBERED_COMMAND = "04_code/implement.md";

function expectNumberedCommandsRouted(profile: AiTool): void {
  const commands = capability(profile, "commands", CommandsCapability);
  const routed = `${profile.directory}commands/aidd/04/implement.md`;
  if (commands?.buildInstallPath(NUMBERED_COMMAND) !== routed) return;
  const reference = `${profile.directory}commands/${NUMBERED_COMMAND}`;
  for (const written of [reference, `@${reference}`]) {
    const expected = written.startsWith("@") ? `@${routed}` : routed;
    expect(profile.rewriteContent(written), `${profile.toolId}: ${written}`).toBe(expected);
  }
}

export const PROFILE_CHECKS: readonly ConformanceCheck<ConformanceSubject>[] = [
  {
    title: "is registered once, under its own id",
    holds: ({ profile, registration }) => {
      expect(registration.filter((other) => other.toolId === profile.toolId)).toHaveLength(1);
      const ids: readonly string[] = isAiTool(profile) ? AI_TOOL_IDS : IDE_TOOL_IDS;
      expect(ids).toContain(profile.toolId);
    },
  },
  aiCheck("has a well-formed shape", (profile) => {
    expect(profile.toolSuffix.startsWith(".")).toBe(true);
    expect(typeof profile.rewriteContent).toBe("function");
    expect(profile.signalDir === null || typeof profile.signalDir === "string").toBe(true);
  }),
  aiCheck("keeps a relative directory ending in a slash", ({ directory }) => {
    expect(!isAbsolute(directory) && directory.endsWith("/") && directory.length > 1).toBe(true);
  }),
  aiCheck(
    "computes every path relative, and keeps commands, rules, agents and flat hooks under its directory",
    (profile) => {
      for (const path of installedPaths(profile)) {
        expectRelative(path, "installed path");
        expect(path.startsWith(profile.directory), `outside ${profile.directory}: ${path}`).toBe(
          true
        );
      }
      for (const contract of contractsOf(profile)) {
        for (const [name, artifact] of supportedArtifacts(contract)) {
          expectRelative(artifact.path("plug", SAMPLE_PATHS[name] ?? "x"), `${name} path`);
        }
      }
      const flat = profile.buildContracts?.flat?.();
      for (const path of flat === undefined ? [] : flatPathsUnderDirectory(flat)) {
        expect(path.startsWith(profile.directory), `outside ${profile.directory}: ${path}`).toBe(
          true
        );
      }
    }
  ),
  aiCheck("builds neither rules nor commands from the plugin tree", (profile) => {
    for (const { artifacts } of contractsOf(profile)) {
      expect(artifacts.rules.supported).toBe(false);
      expect(artifacts.commands.supported).toBe(false);
    }
  }),
  aiCheck("gives every supported artifact a non-empty path", (profile) => {
    for (const contract of contractsOf(profile)) {
      for (const [name, artifact] of supportedArtifacts(contract)) {
        expect(artifact.path("plug", SAMPLE_PATHS[name] ?? "x"), name).not.toBe("");
      }
    }
  }),
  aiCheck("is reachable by at least one build", (profile) => {
    if (profile.section("plugins") === null) return;
    expect(Object.keys(profile.buildContracts ?? {}).length).toBeGreaterThan(0);
  }),
  aiCheck("is probed where it publishes a marketplace", (profile) => {
    if (profile.buildContracts?.marketplace === undefined) return;
    expect(profile.distributionProbes?.marketplace?.length ?? 0).toBeGreaterThan(0);
  }),
  aiCheck("lets its flat build carry hooks exactly when it accepts them", (profile) => {
    const plugins = profile.section("plugins");
    const flat = profile.buildContracts?.flat?.();
    if (plugins?.kind !== "flat" || flat === undefined) return;
    expect(flat.artifacts.hooks.supported).toBe(plugins.hooksAcceptance().accepts);
  }),
  aiCheck("names a variable, never a path", (profile) => {
    const plugins = profile.section("plugins");
    if (plugins?.kind !== "native") return;
    expect(plugins.rootToken()).toMatch(PLUGIN_ROOT_TOKEN);
  }),
  aiCheck("writes its own token into a marketplace build", (profile) => {
    const plugins = profile.section("plugins");
    const marketplace = profile.buildContracts?.marketplace?.();
    if (plugins?.kind !== "native" || marketplace === undefined) return;
    expect(marketplace.pluginRootToken ?? null).toBe(plugins.rootToken());
  }),
  aiCheck("writes no token into a flat build", (profile) => {
    const flat = profile.buildContracts?.flat?.();
    if (flat === undefined) return;
    expect(flat.pluginRootToken).toBeUndefined();
  }),
  aiCheck("declares a plugins capability", (profile) => {
    expect(profile.section("plugins")).not.toBeNull();
  }),
  aiCheck("feeds its mcp file from the mcp config", (profile) => {
    const mcp = capability(profile, "mcp", McpCapability);
    if (mcp === undefined) return;
    expect(mcp.consumes).toContain(CONFIG_MCP);
  }),
  aiCheck("routes a numbered command and its references to the same folder", (profile) => {
    expectNumberedCommandsRouted(profile);
  }),
  aiCheck("names a numbered command after its phase and keeps only what it reads", (profile) => {
    const commands = capability(profile, "commands", CommandsCapability);
    if (commands === undefined) return;
    const source = { name: "implement", description: "Implement a plan", model: "sonnet" };
    const converted = commands.convertFrontmatter(source, NUMBERED_COMMAND);
    expect(converted).toMatchObject({ name: "aidd:04:implement", description: "Implement a plan" });
    expect(converted).not.toHaveProperty("model");
  }),
];

/** The kernel's ids and the registration's agree, in both directions. */
export function registeredIdsMatchKernel(ids: readonly ToolId[]): void {
  const kernel = [...AI_TOOL_IDS, ...IDE_TOOL_IDS];
  expect([...ids].sort()).toEqual([...kernel].sort());
}

export function describeProfileConformance(
  profile: ToolConfig,
  registration: readonly ToolConfig[]
): void {
  describe(profile.toolId, () => {
    for (const check of PROFILE_CHECKS) {
      it(check.title, () => check.holds({ profile, registration }));
    }
  });
}
