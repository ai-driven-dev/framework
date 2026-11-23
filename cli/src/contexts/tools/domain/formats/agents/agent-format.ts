/** One host's agent frontmatter, written from the Claude-format source. Every host declares
 * exactly one, and every path that installs an agent writes through it, so the plugin
 * install and the built distributions cannot diverge. */
export type AgentFrontmatter = (source: Record<string, unknown>) => Record<string, unknown>;

/** Pick only the given keys, in their order, for deterministic output. A key whose value is
 * undefined is omitted. */
export function pickFrontmatterKeys(
  fm: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (fm[key] !== undefined) result[key] = fm[key];
  }
  return result;
}

/** A host without an effort key reads it from the model id, between `open` and `close`. */
export function modelWithEffort(fm: Record<string, unknown>, open: string, close = ""): unknown {
  if (typeof fm.model !== "string" || typeof fm.effort !== "string") return fm.model;
  return `${fm.model}${open}${fm.effort}${close}`;
}

/** A host's agent frontmatter as data: which keys it keeps, in order, and how each is read. */
export interface AgentFrontmatterSpec {
  /** The keys written, in their order. */
  readonly keep: readonly string[];
  /** A written key read from another source key. */
  readonly rename?: Readonly<Record<string, string>>;
  /** The value of a written key the source leaves out. */
  readonly defaults?: Readonly<Record<string, unknown>>;
  /** A host without an effort key reads it from the model id, between these delimiters. */
  readonly effortInModel?: { readonly open: string; readonly close?: string };
  /** Fixed values written after the kept keys. */
  readonly set?: Readonly<Record<string, unknown>>;
}

/** The source frontmatter with each key a spec reads under another name or by default. */
function readThrough(spec: AgentFrontmatterSpec, fm: Record<string, unknown>) {
  const read: Record<string, unknown> = { ...fm };
  for (const [key, from] of Object.entries(spec.rename ?? {})) read[key] = fm[from];
  for (const [key, value] of Object.entries(spec.defaults ?? {})) read[key] = read[key] ?? value;
  if (spec.effortInModel) {
    read.model = modelWithEffort(fm, spec.effortInModel.open, spec.effortInModel.close);
  }
  return read;
}

/** The agent frontmatter a spec declares. */
export function agentFrontmatterOf(spec: AgentFrontmatterSpec): AgentFrontmatter {
  return (fm) => ({ ...pickFrontmatterKeys(readThrough(spec, fm), spec.keep), ...spec.set });
}
