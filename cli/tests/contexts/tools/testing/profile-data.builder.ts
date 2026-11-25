import type { PluginAnswers } from "../../../../src/contexts/tools/contract/tool-profile.js";
import type { AiTool, IdeToolConfig } from "../../../../src/contexts/tools/domain/profile.js";
import { PROFILE_SECTION_KEYS } from "../../../../src/contexts/tools/domain/profile.js";
import { RULE_INPUTS } from "./profile-tables.builder.js";

const INSTALL_KINDS = ["agents", "commands", "rules"] as const;
type InstallKind = (typeof INSTALL_KINDS)[number];
type Frontmatter = Record<string, unknown>;
type Converts = { convertFrontmatter(source: Frontmatter, path?: string): Frontmatter };
type Installs = { buildInstallPath(fileName: string): string | null };

/** Built file names whose install path shows how a profile routes each kind. */
function builtFiles(suffix: string): Record<InstallKind, readonly string[]> {
  return {
    agents: ["reviewer.md", `reviewer${suffix}`, "team/sub/reviewer.md", "helper.txt", ".gitkeep"],
    commands: [
      "04_code/implement.md",
      "01-plan/greet.md",
      "01_plan/02_steps/review.md",
      "00_behavior/auto_accept.md",
      "v2-tools/x.md",
      "review.prompt.md",
      "commit.md",
      "commit",
    ],
    rules: [
      "01-standards/naming.md",
      "01-standards/1-mermaid.md",
      "01-standards/10-mermaid.md",
      "01-standards/naming-2-rules.md",
      `04-tooling/ide-mapping${suffix}`,
      `standards${suffix}`,
      "00-architecture/.gitkeep",
    ],
  };
}

const COMMAND_SOURCE = {
  name: "greet",
  description: "Greet someone",
  "argument-hint": "<name>",
  model: "sonnet",
};
const AGENT_SOURCE = {
  name: "reviewer",
  description: "Review code",
  tools: ["Read"],
  model: "sonnet",
  effort: "high",
};

function installsOf(profile: AiTool) {
  const files = builtFiles(profile.toolSuffix);
  return Object.fromEntries(
    INSTALL_KINDS.flatMap((kind) => {
      const section: Installs | null = profile.section(kind);
      if (section === null) return [];
      return [[kind, Object.fromEntries(files[kind].map((f) => [f, section.buildInstallPath(f)]))]];
    })
  );
}

function frontmatterOf(profile: AiTool) {
  const commands: Converts | null = profile.section("commands");
  const agents: Converts | null = profile.section("agents");
  const rules: Converts | null = profile.section("rules");
  return {
    commands: commands?.convertFrontmatter(COMMAND_SOURCE, "01-plan/greet.md") ?? null,
    agents: agents?.convertFrontmatter(AGENT_SOURCE) ?? null,
    rules:
      rules === null
        ? null
        : Object.fromEntries(
            Object.entries(RULE_INPUTS).map(([name, input]) => [
              name,
              rules.convertFrontmatter({ ...input }),
            ])
          ),
  };
}

function pluginsOf(plugins: PluginAnswers | null) {
  if (plugins === null) return null;
  const delivery = {
    kind: plugins.kind,
    acceptsHooks: plugins.hooksAcceptance().accepts,
    deliversHooksToProject: plugins.deliversHooksToProject(),
  };
  if (plugins.kind === "flat") return { ...delivery, flatLayout: plugins.flatLayout() };
  if (plugins.kind === "native") return { ...delivery, rootToken: plugins.rootToken() };
  return delivery;
}

function aiDataOf(profile: AiTool) {
  return {
    displayName: profile.displayName,
    toolSuffix: profile.toolSuffix,
    signalDir: profile.signalDir,
    configFiles: profile.configFiles(),
    sections: PROFILE_SECTION_KEYS.filter((key) => profile.section(key) !== null),
    builds: Object.keys(profile.buildContracts ?? {}).sort(),
    distribution: {
      manifest: profile.distributionPaths("manifest"),
      marketplace: profile.distributionPaths("marketplace"),
    },
    plugins: pluginsOf(profile.plugins()),
    projectHooks: profile.projectHooksDelivery()?.relativePath ?? null,
    hooksRootToken: profile.hooks?.rootToken ?? null,
    installs: installsOf(profile),
    frontmatter: frontmatterOf(profile),
  };
}

/** What one registered profile declares, as plain data a snapshot pins. */
export function profileData(profile: AiTool | IdeToolConfig) {
  const common = { toolId: profile.toolId, kind: profile.kind, directory: profile.directory };
  return profile.kind === "ai" ? { ...common, ...aiDataOf(profile) } : common;
}
