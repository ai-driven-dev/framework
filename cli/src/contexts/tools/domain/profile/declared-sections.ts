import { tomlAgentToml } from "../formats/agents/toml-agent.js";
import type { TomlCodec } from "../formats/toml.js";
import type { ProfileSection, ProfileSectionKey, ProfileSections } from "../profile.js";
import { AgentsSection } from "../sections/agents-section.js";
import { CommandsSection } from "../sections/commands-section.js";
import { type McpConfigParams, McpConfigPart, type McpSection } from "../sections/mcp-section.js";
import { RulesSection } from "../sections/rules-section.js";
import { SkillsSection } from "../sections/skills-section.js";
import { type ToolFormats, tomlOf } from "./contract-builders.js";

type ParamsOf<T extends new (params: never) => unknown> = ConstructorParameters<T>[0];
type Bound = "directory" | "toolSuffix";

/** A section's parameters without the directory and suffix the profile states once, which it may
 * still override. */
type DeclaredParams<P> = Omit<P, Bound> & Partial<Pick<P, Extract<keyof P, Bound>>>;

type Declared<T extends new (params: never) => unknown> =
  | InstanceType<T>
  | DeclaredParams<ParamsOf<T>>;

/** An MCP file in TOML: the codec is the one the composition wires, and its merge is named as a
 * conversion of that codec. */
export type McpTomlDeclaration = Omit<
  Extract<McpConfigParams, { format: "toml" }>,
  "toml" | "mergeFn"
> & {
  readonly mergeWith?: (toml: TomlCodec) => (existing: string, incoming: string) => string;
};

/** What a profile declares: a section, or the parameters the factory builds it from. */
export interface DeclaredSections
  extends Omit<ProfileSections, "agents" | "skills" | "commands" | "rules" | "mcp"> {
  agents?: Declared<typeof AgentsSection>;
  skills?: Declared<typeof SkillsSection>;
  commands?: Declared<typeof CommandsSection>;
  rules?: Declared<typeof RulesSection>;
  mcp?:
    | McpSection
    | { readonly config?: McpTomlDeclaration; readonly plugin?: McpSection["plugin"] };
}

/** The MCP parts a declaration states, each answering without `undefined`. */
type BuiltMcp<D> = McpSection & {
  readonly [P in keyof D & keyof McpSection]-?: NonNullable<McpSection[P]>;
};

/** The sections a declaration produces: a key it declares answers without `null`. */
export type BuiltSections<S extends DeclaredSections> = ProfileSections & {
  [K in keyof S & ProfileSectionKey as undefined extends S[K] ? never : K]-?: K extends "mcp"
    ? BuiltMcp<S[K]>
    : ProfileSection<K>;
};

/** Where the profile's bound sections land, and the codecs its formats name. */
export interface SectionBinding {
  readonly directory: string;
  readonly toolSuffix: string;
  readonly formats: ToolFormats;
}

function agentsOf(declared: DeclaredSections["agents"], at: SectionBinding) {
  if (declared === undefined || declared instanceof AgentsSection) return declared;
  const serialize =
    declared.format === "toml" && declared.serialize === undefined
      ? { serialize: tomlAgentToml(tomlOf(at.formats)) }
      : {};
  return new AgentsSection({ ...at, ...declared, ...serialize });
}

function mcpOf(declared: DeclaredSections["mcp"], formats: ToolFormats): McpSection | undefined {
  if (declared === undefined) return undefined;
  const { config, plugin } = declared;
  const part =
    config === undefined || config instanceof McpConfigPart
      ? config
      : tomlConfigOf(config, formats);
  return { ...(part && { config: part }), ...(plugin && { plugin }) };
}

function tomlConfigOf(config: McpTomlDeclaration, formats: ToolFormats): McpConfigPart {
  const { mergeWith, ...params } = config;
  const toml = tomlOf(formats);
  const merge = mergeWith === undefined ? {} : { mergeFn: mergeWith(toml) };
  return new McpConfigPart({ ...params, toml, ...merge });
}

function skillsOf(declared: DeclaredSections["skills"], at: SectionBinding) {
  if (declared === undefined || declared instanceof SkillsSection) return declared;
  return new SkillsSection({ directory: at.directory, ...declared });
}

function commandsOf(declared: DeclaredSections["commands"], at: SectionBinding) {
  if (declared === undefined || declared instanceof CommandsSection) return declared;
  return new CommandsSection({ toolSuffix: at.toolSuffix, ...declared });
}

function rulesOf(declared: DeclaredSections["rules"], at: SectionBinding) {
  if (declared === undefined || declared instanceof RulesSection) return declared;
  return new RulesSection({ toolSuffix: at.toolSuffix, ...declared });
}

/** Each declared section, built from its parameters where the profile gave parameters. */
export function buildSections(declared: DeclaredSections, at: SectionBinding): ProfileSections {
  const { agents, skills, commands, rules, mcp, ...rest } = declared;
  const built = {
    agents: agentsOf(agents, at),
    skills: skillsOf(skills, at),
    commands: commandsOf(commands, at),
    rules: rulesOf(rules, at),
    mcp: mcpOf(mcp, at.formats),
  };
  return {
    ...rest,
    ...(built.agents && { agents: built.agents }),
    ...(built.skills && { skills: built.skills }),
    ...(built.commands && { commands: built.commands }),
    ...(built.rules && { rules: built.rules }),
    ...(built.mcp && { mcp: built.mcp }),
  };
}
