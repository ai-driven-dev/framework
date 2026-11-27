import { cp, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPOSITORY_ROOT } from "./repository-root.builder.js";

/** A marketplace over real plugins of this repository, copied once per suite: no route a
 * suite drives writes into its source, so each test links to the one copy instead. */
export interface PluginMarketplaceSource {
  /** Makes `path` the marketplace, without copying it again. */
  linkAt(path: string): Promise<void>;
  remove(): Promise<void>;
}

export async function pluginMarketplaceSource(
  plugins: readonly string[]
): Promise<PluginMarketplaceSource> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "aidd-marketplace-source-")));
  await mkdir(join(root, ".claude-plugin"), { recursive: true });
  for (const plugin of plugins) {
    await cp(join(REPOSITORY_ROOT, "plugins", plugin), join(root, "plugins", plugin), {
      recursive: true,
    });
  }
  await writeFile(
    join(root, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "aidd-framework",
      version: "0.1.0",
      description: "Hook routes",
      owner: { name: "Test" },
      plugins: plugins.map((name) => ({ name, source: `./plugins/${name}`, strict: true })),
    })
  );
  return {
    linkAt: (path) => symlink(root, path, "dir"),
    remove: () => rm(root, { recursive: true, force: true }),
  };
}
