/** Native suggestions carry only explicit project settings. Model identifiers stay literal. */
export function nativeAgentOptions(
  requested: { model?: string; effort?: string },
  effortField: string,
  efforts?: readonly string[]
): Readonly<Record<string, string>> {
  if (
    requested.effort !== undefined &&
    efforts !== undefined &&
    !efforts.includes(requested.effort)
  ) {
    throw new Error(
      `Unsupported effort "${requested.effort}"; use ${efforts.join(", ")} or omit effort to inherit.`
    );
  }
  return {
    ...(requested.model === undefined ? {} : { model: requested.model }),
    ...(requested.effort === undefined ? {} : { [effortField]: requested.effort }),
  };
}

/** Hosts whose model selector includes its effort need an explicit model to avoid guessing it. */
export function embeddedAgentOptions(
  requested: { model?: string; effort?: string },
  embed: (model: string, effort: string) => string
): Readonly<Record<string, string>> {
  if (requested.effort === undefined)
    return requested.model === undefined ? {} : { model: requested.model };
  if (requested.model === undefined)
    throw new Error(
      "An explicit model is required with effort; set model or omit effort to inherit."
    );
  return { model: embed(requested.model, requested.effort) };
}
