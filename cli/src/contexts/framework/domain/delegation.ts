import { asPlainObject } from "../../../kernel/reading/plain-object.js";

export interface DelegationSuggestion {
  readonly plugin: string;
  readonly role: string;
  readonly canonical: string;
  readonly requested: { readonly model?: string; readonly effort?: string };
}

export interface DelegationResolution {
  readonly task: string;
  readonly tool: string;
  readonly configured: boolean;
  readonly canonicalAgent?: string;
  readonly agent?: {
    readonly name: string;
    readonly path: string;
    readonly mode: "flat" | "marketplace";
  };
  readonly requested: DelegationSuggestion["requested"];
  readonly native: Readonly<Record<string, string>>;
  readonly nativeSurface: "agent-configuration" | "spawn";
  readonly effectiveRuntime: "unknown";
  readonly diagnostics: readonly string[];
}

function object(value: unknown, path: string): Record<string, unknown> {
  const result = asPlainObject(value);
  if (result === null) throw new Error(`${path}: expected a JSON object; correct this field.`);
  return result;
}

function keys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0)
    throw new Error(
      `${path}: unsupported field ${unexpected.join(", ")}; use ${allowed.join(", ")}.`
    );
}

function setting(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value === "" ||
    Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  ) {
    throw new Error(
      `${path}: expected a nonempty string without surrounding whitespace; correct it or omit it to inherit.`
    );
  }
  return value;
}

/** Validate the requested task/host only; unrelated configuration has no bearing on this query. */
export function parseDelegation(
  raw: string | null,
  task: string,
  tool: string,
  file: string
): DelegationSuggestion | undefined {
  if (raw === null) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${file}: expected valid JSON; repair the file before resolving delegation.`);
  }
  const root = object(parsed, file);
  if (root.delegation === undefined) return undefined;
  const delegation = object(root.delegation, `${file}: delegation`);
  if (!Object.hasOwn(delegation, task)) return undefined;
  const path = `${file}: delegation.${task}`;
  const entry = object(delegation[task], path);
  keys(entry, ["agent", "tools"], path);
  if (
    typeof entry.agent !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(entry.agent)
  ) {
    throw new Error(
      `${path}.agent: expected a canonical plugin:role address, for example aidd-dev:explorer.`
    );
  }
  const colon = entry.agent.indexOf(":");
  const plugin = entry.agent.slice(0, colon);
  const role = entry.agent.slice(colon + 1);
  let requested: DelegationSuggestion["requested"] = {};
  if (entry.tools !== undefined) {
    const tools = object(entry.tools, `${path}.tools`);
    if (Object.hasOwn(tools, tool)) {
      const selected = object(tools[tool], `${path}.tools.${tool}`);
      keys(selected, ["model", "effort"], `${path}.tools.${tool}`);
      const model = setting(selected.model, `${path}.tools.${tool}.model`);
      const effort = setting(selected.effort, `${path}.tools.${tool}.effort`);
      requested = {
        ...(model === undefined ? {} : { model }),
        ...(effort === undefined ? {} : { effort }),
      };
    }
  }
  return { plugin, role, canonical: entry.agent, requested };
}
