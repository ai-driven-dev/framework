type PathOf = (plugin: string, rel: string) => string;

/** Where a flat build puts what a relative link points at: an agent or a skill goes where the
 * tool keeps its own, anything else stays where the plugin has it. */
export function flatTargetsOf(agentPath: PathOf, skillPath: PathOf): PathOf {
  return (plugin, rel) => {
    if (rel.startsWith("agents/")) return agentPath(plugin, rel);
    if (rel.startsWith("skills/")) return skillPath(plugin, rel);
    return rel;
  };
}
