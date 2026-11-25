import type { RawCatalogFetcher } from "../../../src/contexts/distribution/ports/raw-catalog-fetcher.js";
import type { PluginSourceGitHub } from "../../../src/shared/domain/plugin/source.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../src/shared/ports/file-writer.js";
import { InMemoryFileAdapter } from "./in-memory-file-adapter.fake.js";

/** What a forge answers for a catalog file: the catalog text, or an error it throws. */
export type RawCatalogWorld = (source: PluginSourceGitHub, catalogPath: string) => string;

/** A forge held in memory, answering from the world it is given. The one double every consumer
 * uses, and the one the raw catalog contract certifies against the real adapter. */
export class InMemoryRawCatalog implements RawCatalogFetcher {
  constructor(private readonly world: RawCatalogWorld) {}

  async fetchCatalog(source: PluginSourceGitHub, catalogPath: string): Promise<string> {
    return this.world(source, catalogPath);
  }
}

/** A raw catalog source for a test whose marketplaces are never fetched from GitHub: reaching
 * it fails the test. */
export function unusedRawCatalog(): {
  fetcher: RawCatalogFetcher;
  fs: FileReader & FileWriter;
} {
  const world: RawCatalogWorld = () => {
    throw new Error("a raw catalog was fetched in a test that declared none");
  };
  return { fetcher: new InMemoryRawCatalog(world), fs: new InMemoryFileAdapter() };
}

const CLONE_REQUIRING_CATALOG = JSON.stringify({
  plugins: [{ name: "cloned", source: "./plugins/cloned" }],
});

/** A raw catalog whose plugins live inside the repository, so a GitHub marketplace is cloned
 * through the plugin fetcher the test supplies. */
export function cloneRequiringRawCatalog(): {
  fetcher: RawCatalogFetcher;
  fs: FileReader & FileWriter;
} {
  return {
    fetcher: new InMemoryRawCatalog(() => CLONE_REQUIRING_CATALOG),
    fs: new InMemoryFileAdapter(),
  };
}
