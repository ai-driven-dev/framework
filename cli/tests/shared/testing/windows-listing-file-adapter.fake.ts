import { InMemoryFileAdapter } from "./in-memory-file-adapter.fake.js";

/**
 * An in-memory tree that lists the way a Windows host does: every separator below the listed
 * directory is a backslash. `InMemoryFileAdapter` keys on forward slashes alone, so a backslash
 * seeded into it never reaches the code that has to normalise one.
 */
export class WindowsListingFileAdapter extends InMemoryFileAdapter {
  override async listFilesRecursive(dirPath: string): Promise<string[]> {
    const listed = await super.listFilesRecursive(dirPath);
    const prefix = dirPath.endsWith("/") ? dirPath : `${dirPath}/`;
    return listed.map((path) =>
      path.startsWith(prefix) ? prefix + path.slice(prefix.length).replaceAll("/", "\\") : path
    );
  }
}
