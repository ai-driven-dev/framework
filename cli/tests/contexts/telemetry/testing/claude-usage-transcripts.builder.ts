import { cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const FIXTURES = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "fixtures",
  "claude-usage",
  "projects"
);

const jsonText = (path: string): string => JSON.stringify(path).slice(1, -1);

async function filesUnder(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await filesUnder(path)));
    else found.push(path);
  }
  return found;
}

async function pointAtRepositories(
  path: string,
  repositories: { readonly a: string; readonly b: string }
): Promise<void> {
  const text = await readFile(path, "utf8");
  await writeFile(
    path,
    text
      .replaceAll("/work/repo-wt-a", jsonText(repositories.a))
      .replaceAll("/work/repo-wt-b", jsonText(repositories.b))
  );
}

/** The fixture transcripts copied under `claudeConfig/projects`, their machine paths pointed at
 * the given repositories. `only` keeps the files whose path ends with one of the names. */
export async function writeUsageTranscripts(
  claudeConfig: string,
  repositories: { readonly a: string; readonly b: string },
  only?: readonly string[]
): Promise<void> {
  const target = join(claudeConfig, "projects");
  await cp(FIXTURES, target, { recursive: true });
  for (const path of await filesUnder(target)) {
    if (only !== undefined && !only.some((name) => path.endsWith(name))) await rm(path);
    else await pointAtRepositories(path, repositories);
  }
}
