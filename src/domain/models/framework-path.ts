/**
 * Returns true if the given value refers to a local path or tarball
 * rather than a remote repository reference (owner/repo or version tag).
 */
export function isLocalPath(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.endsWith(".tar.gz") ||
    value.endsWith(".tgz")
  );
}
