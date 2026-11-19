import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { expect } from "vitest";

/** Compare `actual` to the JSON stored at `file`, or rewrite the file when `UPDATE_GOLDEN=1`.
 * Regeneration is refused in CI: a golden changes by a reviewed commit, never silently. */
export async function expectGolden(
  file: string,
  actual: unknown,
  env: Record<string, string | undefined> = process.env
): Promise<void> {
  if (env.UPDATE_GOLDEN === "1") {
    if (env.CI) throw new Error(`UPDATE_GOLDEN is set in CI: refusing to rewrite ${file}`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(actual, null, 2)}\n`, "utf-8");
    return;
  }

  expect(actual).toEqual(JSON.parse(await readFile(file, "utf-8")));
}
