import { InvalidPluginComponentKindError } from "../errors.js";

export type PluginComponentKind = "skills" | "agents" | "hooks" | "mcp" | "full";

const VALID_KINDS: readonly PluginComponentKind[] = ["skills", "agents", "hooks", "mcp", "full"];

export function parsePluginComponentKind(s: string): PluginComponentKind {
  if ((VALID_KINDS as readonly string[]).includes(s)) {
    return s as PluginComponentKind;
  }
  throw new InvalidPluginComponentKindError(s);
}
