import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isRecord, parseJsonRecord } from "../../shared/testing/json-value.builder.js";
import { REPOSITORY_ROOT } from "../../shared/testing/repository-root.builder.js";

/**
 * The real plugin alone under its real marketplace entry, as a local source. A build or a setup
 * reads every plugin it is given, so the nine of the repository cost nine times the proof of one.
 */
export async function singlePluginSource(
  plugin: string
): Promise<{ readonly source: string; readonly remove: () => Promise<void> }> {
  const source = await mkdtemp(join(tmpdir(), "aidd-single-plugin-source-"));
  await mkdir(join(source, ".claude-plugin"), { recursive: true });
  await cp(join(REPOSITORY_ROOT, "plugins", plugin), join(source, "plugins", plugin), {
    recursive: true,
  });
  const marketplace = parseJsonRecord(
    await readFile(join(REPOSITORY_ROOT, ".claude-plugin", "marketplace.json"), "utf8")
  );
  const entries = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
  await writeFile(
    join(source, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      ...marketplace,
      plugins: entries.filter((entry) => isRecord(entry) && entry.name === plugin),
    })
  );
  return { source, remove: () => rm(source, { recursive: true, force: true }) };
}
