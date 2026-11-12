import type { FlatInstallSection, FlatSkillLayout } from "../../contract/tool-profile.js";

/** Where a flat plugin's file lands under the tool's `directory`: a skill is nested under its
 * plugin, or prefixed with it on a single-level scan; every other section is nested. */
export function flatInstallPath(
  directory: string,
  skillLayout: FlatSkillLayout,
  section: FlatInstallSection,
  pluginName: string,
  fileName: string
): string {
  if (section === "skills" && skillLayout === "single-level") {
    return `${directory}skills/${pluginName}-${fileName}`;
  }
  return `${directory}${section}/${pluginName}/${fileName}`;
}

/** Whether a built, project-relative path is one of `pluginName`'s files: the folder of a nested
 * skill is the plugin's own name, every other first segment starts with it and a hyphen. */
export function ownsFlatPath(
  directory: string,
  skillLayout: FlatSkillLayout,
  relativePath: string,
  pluginName: string
): boolean {
  const segments = relativePath.split("/");
  if (segments[0] !== directory.replace(/\/$/, "") || segments.length < 3) return false;
  if (segments[1] === "skills" && skillLayout === "nested") return segments[2] === pluginName;
  return segments[2].startsWith(`${pluginName}-`);
}
