import { readFile, stat } from "node:fs/promises";
import { isErrnoException } from "./json-file.js";

const ABSENT = new Set(["ENOENT", "ENOTDIR"]);

/** A file's text, or `null` when there is no such file. Any other failure is thrown: a file
 * that cannot be read is not a file that is absent. */
export async function readTextIfPresent(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isErrnoException(error) && ABSENT.has(error.code ?? "")) return null;
    throw error;
  }
}

/** When a file was last written, in milliseconds, or `null` when there is no such file. */
export async function modifiedAtIfPresent(path: string): Promise<number | null> {
  try {
    return (await stat(path)).mtimeMs;
  } catch (error) {
    if (isErrnoException(error) && ABSENT.has(error.code ?? "")) return null;
    throw error;
  }
}
