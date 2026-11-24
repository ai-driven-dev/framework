/** An agent file's name without its extension: `.md`, or `.md` after an `.agent` infix. */
export function agentStem(agentFile: string): string {
  return agentFile.replace(/(\.agent)?\.md$/, "");
}

/** The name a flat layout gives an agent: its plugin and its file, so two plugins' agents of one
 * file name stay two agents. */
export function pluginAgentName(plugin: string, agentFile: string): string {
  return `${plugin}-${agentStem(agentFile)}`;
}

/**
 * Where a tool's flat plugin files land, declared once. A build writes them there, an install
 * writes them there, and the owner of a built path is read back from the same declaration.
 * Flat mode carries no `<plugin>/` segment on an agent, and a skill is either nested under its
 * plugin (every name below it survives, so a script's `require()` still resolves) or prefixed by
 * it on a single-level scan (the hyphen lands on the skill folder).
 */
export interface FlatArtifactLayout {
  readonly directory: string;
  readonly skillsDir: string;
  readonly agentsDir: string;
  readonly skills: "nested" | "single-level";
  /** A rule under its plugin's folder, or at the top of the rules folder named by its plugin,
   * where the tool applies it to every file whatever its `paths` say. */
  readonly rules: "nested" | "top-level-unscoped";
  readonly agent: { readonly ext: string } | { readonly folderFile: string };
}

export function flatArtifactLayout(
  directory: string,
  parts: Pick<FlatArtifactLayout, "skills" | "agent"> &
    Partial<Pick<FlatArtifactLayout, "skillsDir" | "agentsDir" | "rules">>
): FlatArtifactLayout {
  return {
    directory,
    skillsDir: parts.skillsDir ?? `${directory}skills/`,
    agentsDir: parts.agentsDir ?? `${directory}agents/`,
    skills: parts.skills,
    rules: parts.rules ?? "nested",
    agent: parts.agent,
  };
}

/** A skill file's path, given its path below `skills/`. */
export function flatSkillPath(
  layout: FlatArtifactLayout,
  plugin: string,
  skillRelPath: string
): string {
  const rest = skillRelPath.replace(/^skills\//, "");
  return layout.skills === "nested"
    ? `${layout.skillsDir}${plugin}/${rest}`
    : `${layout.skillsDir}${plugin}-${rest}`;
}

/** An agent's path, given its file name or its path below `agents/`. */
export function flatAgentFilePath(
  layout: FlatArtifactLayout,
  plugin: string,
  agentFile: string
): string {
  const name = pluginAgentName(plugin, agentFile.replace(/^agents\//, ""));
  return "folderFile" in layout.agent
    ? `${layout.agentsDir}${name}/${layout.agent.folderFile}`
    : `${layout.agentsDir}${name}${layout.agent.ext}`;
}

/** Where a file of a section lands: skills and agents as a build places them, every other section
 * nested under its plugin. */
export function flatSectionPath(
  layout: FlatArtifactLayout,
  section: "commands" | "agents" | "rules" | "skills",
  file: { readonly plugin: string; readonly name: string }
): string {
  const { plugin, name } = file;
  if (section === "skills") return flatSkillPath(layout, plugin, name);
  if (section === "agents") return flatAgentFilePath(layout, plugin, name);
  if (section === "rules" && layout.rules === "top-level-unscoped") {
    return `${layout.directory}rules/${plugin}-${name.replaceAll("/", "-")}`;
  }
  return `${layout.directory}${section}/${plugin}/${name}`;
}

/** The glob naming every rule a plugin placed at the top of the rules folder, or null where
 * rules sit under the plugin's own folder and need no listing. */
export function flatRulesGlob(layout: FlatArtifactLayout, plugin: string): string | null {
  return layout.rules === "top-level-unscoped" ? `${layout.directory}rules/${plugin}-*.md` : null;
}

/** Whether a project-relative path is one of the plugin's skills or agents: the inverse of the
 * two placements above, read from the same declaration.
 *
 * Limit: a flat single-level skill or agent is owned by the `<plugin>-` name prefix, so plugin
 * "aidd" also claims the `aidd-x-...` artifacts of a sibling plugin "aidd-x". No framework plugin
 * name is a prefix of another, so nothing guards it; a plugin named that way must change the
 * placement first. The nested skill layout (`<plugin>/`) has no such overlap. */
export function ownsFlatArtifact(
  layout: FlatArtifactLayout,
  relativePath: string,
  plugin: string
): boolean {
  const below = (dir: string): string | null =>
    relativePath.startsWith(dir) ? relativePath.slice(dir.length) : null;
  const skill = below(layout.skillsDir);
  if (skill !== null) {
    return layout.skills === "nested"
      ? skill.startsWith(`${plugin}/`)
      : skill.startsWith(`${plugin}-`);
  }
  return below(layout.agentsDir)?.startsWith(`${plugin}-`) ?? false;
}

export function genericFlatHooksFile(hooksPrefix: string, plugin: string): string {
  return `${hooksPrefix}${plugin}.hooks.json`;
}

export function genericFlatHooksScriptPath(
  hooksPrefix: string,
  plugin: string,
  scriptRelPath: string
): string {
  return `${hooksPrefix}${plugin}/${scriptRelPath}`;
}

export function flatMcpKeyPrefix(plugin: string): string {
  return `${plugin}-`;
}

/**
 * A flat-mode loader's own module: the one hook script a plugin ships that the loader
 * imports as itself. Kept in its own directory, apart from the per-plugin hooks tree, so
 * renaming it to the plugin's name can never collide with another plugin shipping one.
 */
export interface FlatHooksLoaderEntry {
  readonly dir: string;
  readonly baseName: string;
}

/**
 * A script named `loaderEntry.baseName` is the loader's own runtime module (see
 * {@link FlatHooksLoaderEntry}): it lands flat in `loaderEntry.dir` under the plugin's own
 * name, so two plugins shipping one cannot collide. Every other script is namespaced under
 * `perPluginHooksDir`, giving a loader that also scans one flat directory a landing spot
 * for the scripts it does not import directly. `null` means no such convention.
 */
export function flatHooksPathWithLoaderEntry({
  perPluginHooksDir,
  loaderEntry,
  plugin,
  hooksRelativePath,
}: {
  perPluginHooksDir: string;
  loaderEntry: FlatHooksLoaderEntry | null;
  plugin: string;
  hooksRelativePath: string;
}): string {
  const rest = hooksRelativePath.replace(/^hooks\//, "");
  if (loaderEntry !== null && rest === loaderEntry.baseName) {
    return `${loaderEntry.dir}${plugin}.js`;
  }
  return genericFlatHooksScriptPath(perPluginHooksDir, plugin, rest);
}

/** Where a file of a plugin's hooks lands, given its path in the plugin: the loader's own module
 * beside the loader, the plugin's hooks file in the plugin's own, every other script in a folder
 * of the plugin's under `scriptsDir`. */
export function flatHooksRoutePath(
  route: { readonly scriptsDir: string; readonly loaderEntry?: FlatHooksLoaderEntry },
  plugin: string,
  relPath: string
): string {
  const { scriptsDir, loaderEntry } = route;
  if (loaderEntry !== undefined) {
    return flatHooksPathWithLoaderEntry({
      perPluginHooksDir: scriptsDir,
      loaderEntry,
      plugin,
      hooksRelativePath: relPath,
    });
  }
  // Limit: a flat tool without a loader entry places `hooks/<plugin>.hooks.json` at
  // `<dir><plugin>.hooks.json`; real plugins ship only `hooks/hooks.json`.
  if (relPath === `hooks/${plugin}.hooks.json`) return genericFlatHooksFile(scriptsDir, plugin);
  return genericFlatHooksScriptPath(scriptsDir, plugin, relPath.replace(/^hooks\//, ""));
}
