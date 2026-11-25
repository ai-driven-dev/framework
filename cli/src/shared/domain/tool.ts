// A tool id is a name only a registered profile can bear. The brand carries no list: which names
// exist is the registered profiles' to say, and `defineAiTool` and `defineIdeTool` are the only
// places a written name becomes an id. Anything else asks the catalog.
declare const aiToolBrand: unique symbol;
declare const ideToolBrand: unique symbol;

export type AiToolId = string & { readonly [aiToolBrand]: true };
export type IdeToolId = string & { readonly [ideToolBrand]: true };
export type ToolId = AiToolId | IdeToolId;
export type ToolCategory = "ai" | "ide";

/** Answers a written id with the tool it names, or `null` when no registered tool bears it. */
export type ToolIdResolver = (raw: string) => ToolId | null;
