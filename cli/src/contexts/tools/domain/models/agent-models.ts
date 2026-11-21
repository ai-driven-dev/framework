/** How much model a piece of work needs, from `smart` down to `light`; `AGENT_MODELS` describes
 * each and says which one the main session and each agent role run on. */
export type ModelTier = "smart" | "standard" | "light";

/** One tier at one provider, in the provider's own model id. */
export interface ModelProfile {
  readonly model: string;
  readonly effort: string;
}

export interface AgentModels {
  readonly tiers: Readonly<Record<ModelTier, string>>;
  /** The tier the main session runs on. */
  readonly main: ModelTier;
  /** Each shipped agent's tier, by its file name. */
  readonly roles: Readonly<Record<string, ModelTier>>;
  readonly providers: Readonly<Record<string, Readonly<Record<ModelTier, ModelProfile>>>>;
}

/** The model ids each provider runs a tier on. When a provider ships or retires a model, update
 * this table, the one in the agent guide, and the tests that name the ids. Which providers a
 * tool runs is its profile's to declare. */
export const AGENT_MODELS: AgentModels = {
  tiers: {
    smart: "Judgment a fresh context must get right on its own: reviewing finished work.",
    standard: "The main session: frames the request, plans, delegates and accepts the result.",
    light:
      "Bounded work with a precise brief: exploring, executing one task, validating against criteria.",
  },
  main: "standard",
  roles: {
    explorer: "light",
    executor: "light",
    validator: "light",
    reviewer: "smart",
  },
  providers: {
    openai: {
      smart: { model: "gpt-6.1-sol", effort: "high" },
      standard: { model: "gpt-6.1-terra", effort: "medium" },
      light: { model: "gpt-6-luna", effort: "medium" },
    },
    anthropic: {
      smart: { model: "claude-opus-5-5", effort: "high" },
      standard: { model: "claude-sonnet-5-5", effort: "medium" },
      light: { model: "claude-haiku-5-5", effort: "medium" },
    },
    mistral: {
      smart: { model: "mistral-large-4", effort: "high" },
      standard: { model: "mistral-large-4", effort: "medium" },
      light: { model: "mistral-small-latest", effort: "high" },
    },
  },
};

/** Every provider the table defines, in its order: the order a help text names them. */
export function agentProviders(): readonly string[] {
  return Object.keys(AGENT_MODELS.providers);
}

/** The tier an agent of that file name runs on, or undefined for a role the table lists not. */
export function roleTier(fileName: string): ModelTier | undefined {
  const role = fileName.replace(/\.md$/, "");
  return Object.hasOwn(AGENT_MODELS.roles, role) ? AGENT_MODELS.roles[role] : undefined;
}
