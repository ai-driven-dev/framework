import { resolve } from "node:path";
import type { FileReader } from "../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../kernel/ports/file-writer.js";
import { assertNoSymlinksWithinRoot } from "./ownership/project-path-boundary.js";

export async function assertUpgradeWrite(
  fs: FileReader,
  projectRoot: string,
  path: string,
  tracked: ReadonlyMap<string, string>
): Promise<void> {
  await assertNoSymlinksWithinRoot(fs, projectRoot, path);
  const expected = tracked.get(resolve(path));
  if (await fs.fileExists(path)) {
    if (expected === undefined) throw new Error(`Cannot overwrite untracked file '${path}'.`);
    if ((await fs.readFileHash(path)).value !== expected)
      throw new Error(`Cannot overwrite modified file '${path}'.`);
  } else if (expected !== undefined) {
    throw new Error(`Cannot overwrite missing tracked file '${path}'.`);
  }
}

/** Protect project content while replacing a plugin; the original hashes are its ownership proof. */
export function protectUpgradeWrites<T extends FileReader & FileWriter>(
  fs: T,
  projectRoot: string,
  tracked: ReadonlyMap<string, string>
): T {
  const owned = new Map([...tracked].map(([path, hash]) => [resolve(projectRoot, path), hash]));
  return new Proxy(fs, {
    get(target, property, receiver) {
      if (property === "writeFile") {
        return async (path: string, content: string) => {
          await assertUpgradeWrite(target, projectRoot, path, owned);
          await target.writeFile(path, content);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
