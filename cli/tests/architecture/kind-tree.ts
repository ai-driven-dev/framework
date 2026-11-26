import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CLI_ROOT, canonicalPath } from "./source-graph.js";

const CODE_FILE = /\.(?:ts|mts|cts|js|mjs|cjs)$/;

/** Every code file under a folder of the package, as a canonical path. */
export function codeFilesUnder(dir: string): string[] {
  return readdirSync(join(CLI_ROOT, dir), { recursive: true, encoding: "utf8" })
    .map((entry) => canonicalPath(join(dir, entry)))
    .filter((path) => CODE_FILE.test(path))
    .sort();
}
