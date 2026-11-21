import type { RawCatalogFetcher } from "../../../src/contexts/distribution/ports/raw-catalog-fetcher.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../src/shared/ports/file-writer.js";
import { InMemoryFileAdapter } from "./in-memory-file-adapter.fake.js";

/** A raw catalog source for a test whose marketplaces are never fetched from GitHub: reaching
 * it fails the test. */
export function unusedRawCatalog(): {
  fetcher: RawCatalogFetcher;
  fs: FileReader & FileWriter;
} {
  return {
    fetcher: {
      fetchCatalog: async () => {
        throw new Error("a raw catalog was fetched in a test that declared none");
      },
    },
    fs: new InMemoryFileAdapter(),
  };
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
    fetcher: { fetchCatalog: async () => CLONE_REQUIRING_CATALOG },
    fs: new InMemoryFileAdapter(),
  };
}
