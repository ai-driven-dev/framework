/** The candidate files the project has, asked tier by tier until a tier has one. */
export async function presentUpToFirstTier(
  tiers: readonly (readonly string[])[],
  exists: (relativePath: string) => Promise<boolean>
): Promise<Set<string>> {
  const present = new Set<string>();
  for (const tier of tiers) {
    for (const path of tier) if (await exists(path)) present.add(path);
    if (present.size > 0) break;
  }
  return present;
}
