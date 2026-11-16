import { parseFrontmatter, serializeFrontmatter } from "../../../../shared/domain/markdown.js";
import type { ToolBuildContract } from "../../contract/build-contract.js";
import type { AgentModelAnswers, ModelChoice, RoleModels } from "../../contract/tool-profile.js";
import { AGENT_MODELS, type ModelTier, roleTier } from "../models/agent-models.js";

/** The user settings file where a tool reads its main session's model. */
export interface MainSessionSettings {
  /** Its JSON file name, read from the tool's machine-wide directory where the tool declares no
   * user settings path of its own. */
  readonly settingsFile: string;
  /** The JSON schema heading a file aidd creates, absent where the tool publishes none. */
  readonly schema?: string;
  /** The tool's key for the effort, absent where its settings take none. */
  readonly effortKey?: string;
}

export interface ModelsParams {
  /** The providers the tool runs, a subset of those `AGENT_MODELS` defines. */
  readonly providers: readonly string[];
  /** The tool names a model `<provider>/<model>`. */
  readonly providerPrefix?: boolean;
  /** Absent, the main session's model stays the tool's choice. */
  readonly main?: MainSessionSettings;
  /** The tool's own id for a model it spells differently, by the provider's id. */
  readonly nativeModels?: Readonly<Record<string, string>>;
}

/** The providers whose models a tool's main session and agents run on, and how it names them. */
export class ModelsSection {
  readonly #params: ModelsParams;

  constructor(params: ModelsParams) {
    for (const provider of params.providers) {
      if (!Object.hasOwn(AGENT_MODELS.providers, provider)) {
        throw new Error(`"${provider}" is no provider AGENT_MODELS defines.`);
      }
    }
    this.#params = params;
  }

  /** What an outside caller asks of these models, refusals naming the tool. */
  answersFor(toolId: string): AgentModelAnswers {
    return {
      providers: () => this.#params.providers,
      supportedProvider: (provider) => this.supportedProvider(toolId, provider),
      mainModel: (provider) => {
        const { model, effort } = this.tierModel(provider, AGENT_MODELS.main);
        return this.#params.main?.effortKey === undefined ? { model } : { model, effort };
      },
      roleModels: (provider) => this.roleModels(provider),
      mainSettings: () => {
        const main = this.#params.main;
        if (main === undefined) return null;
        return main.schema === undefined
          ? { file: main.settingsFile }
          : { file: main.settingsFile, schema: main.schema };
      },
      mainSettingsValues: (provider) => this.mainSettingsValues(provider),
    };
  }

  /** Gives every agent of a role the framework tiers its tier's model and effort at the provider,
   * before the tool writes it. A model the agent declares itself is kept. */
  withAgentModels(
    contract: ToolBuildContract,
    toolId: string,
    provider: string
  ): ToolBuildContract {
    const chosen = this.supportedProvider(toolId, provider);
    const agents = contract.artifacts.agents;
    if (!agents.supported) return contract;
    const write = agents.transform ?? ((content: string) => content);
    const transform = (content: string, plugin: string, fileName: string): string => {
      const { frontmatter, body } = parseFrontmatter(content);
      const tier = roleTier(fileName);
      if (tier === undefined || frontmatter.model !== undefined) {
        return write(content, plugin, fileName);
      }
      const modelled = { ...frontmatter, ...this.tierModel(chosen, tier) };
      return write(serializeFrontmatter(modelled, body), plugin, fileName);
    };
    return { ...contract, artifacts: { ...contract.artifacts, agents: { ...agents, transform } } };
  }

  private supportedProvider(toolId: string, provider: string): string {
    const providers = this.#params.providers;
    if (!providers.includes(provider)) {
      throw new Error(
        `Provider "${provider}" is not supported for "${toolId}". Use: ${providers.join(", ")}.`
      );
    }
    return provider;
  }

  /** A tier's model and effort at the provider, in the tool's own model ids. */
  private tierModel(provider: string, tier: ModelTier): ModelChoice {
    const profile = AGENT_MODELS.providers[provider][tier];
    const prefix = this.#params.providerPrefix === true ? `${provider}/` : "";
    const model = this.#params.nativeModels?.[profile.model] ?? profile.model;
    return { model: `${prefix}${model}`, effort: profile.effort };
  }

  private roleModels(provider: string): readonly RoleModels[] {
    const tiers = Object.keys(AGENT_MODELS.tiers) as ModelTier[];
    return tiers.flatMap((tier) => {
      const roles = Object.keys(AGENT_MODELS.roles).filter(
        (role) => AGENT_MODELS.roles[role] === tier
      );
      return roles.length === 0 ? [] : [{ roles, ...this.tierModel(provider, tier) }];
    });
  }

  /** The main session's tier at the provider, under the tool's own keys; the effort only where
   * the tool has a key for it. Empty for a tool whose main session aidd leaves alone. */
  private mainSettingsValues(provider: string): Record<string, string> {
    const main = this.#params.main;
    if (main === undefined) return {};
    const { model, effort } = this.tierModel(provider, AGENT_MODELS.main);
    return main.effortKey === undefined ? { model } : { model, [main.effortKey]: effort };
  }
}
