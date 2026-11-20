import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { expect } from "vitest";

/** Compare `actual` to the JSON stored at `file`, or rewrite the file when `UPDATE_GOLDEN=1`.
 * `compare` runs against the stored value in place of the default equality.
 * Regeneration is refused in CI: a golden changes by a reviewed commit, never silently. */
export async function expectGolden<T = unknown>(
  file: string,
  actual: T,
  {
    env = process.env,
    compare = (stored) => expect(actual).toEqual(stored),
  }: {
    env?: Record<string, string | undefined>;
    /** Replaces the whole-value comparison, for a golden whose failure needs a shorter report. */
    compare?: (stored: T) => void;
  } = {}
): Promise<void> {
  if (env.UPDATE_GOLDEN === "1") {
    if (env.CI) throw new Error(`UPDATE_GOLDEN is set in CI: refusing to rewrite ${file}`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(actual, null, 2)}\n`, "utf-8");
    return;
  }

  compare(JSON.parse(await readFile(file, "utf-8")) as T);
}
