import type { InstallationFile } from "./installation-file.js";

// Shared vocabulary because `removeRedundantGitkeeps` below reasons about it independently
// of any context's directory conventions.
export const GITKEEP_FILE = ".gitkeep";

export function removeRedundantGitkeeps(files: InstallationFile[]): InstallationFile[] {
  const nonEmptyDirs = new Set(
    files
      .filter((f) => !f.relativePath.endsWith(`/${GITKEEP_FILE}`))
      .map((f) => f.relativePath.split("/").slice(0, -1).join("/"))
  );
  return files.filter((f) => {
    if (!f.relativePath.endsWith(`/${GITKEEP_FILE}`)) return true;
    const dir = f.relativePath.split("/").slice(0, -1).join("/");
    return !nonEmptyDirs.has(dir);
  });
}
