import { InMemoryFileAdapter } from "./in-memory-file-adapter.fake.js";

/**
 * An in-memory tree that lists the way a Windows host does: the listed directory is joined to
 * what lies below it, and every separator there, with a backslash. `InMemoryFileAdapter` keys
 * on forward slashes alone, so a backslash seeded into it never reaches the code that has to
 * normalise one.
 */
export class WindowsListingFileAdapter extends InMemoryFileAdapter {
  override async listFilesRecursive(dirPath: string): Promise<string[]> {
    const listed = await super.listFilesRecursive(dirPath);
    const dir = dirPath.endsWith("/") ? dirPath.slice(0, -1) : dirPath;
    return listed.map((path) =>
      path.startsWith(`${dir}/`)
        ? `${dir}\\${path.slice(dir.length + 1).replaceAll("/", "\\")}`
        : path
    );
  }
}
