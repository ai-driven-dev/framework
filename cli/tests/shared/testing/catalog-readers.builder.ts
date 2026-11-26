import { CheckMarketplaceSource } from "../../../src/contexts/host-registration/application/check-marketplace-source.use-case.js";
import type { CatalogReaders } from "../../../src/contexts/host-registration/application/register/registration-run.js";
import { catalogIdentityReader } from "../../../src/contexts/host-registration/infrastructure/marketplace/marketplace-registry-reader.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";

/** What reads a catalogue, built over one file reader. */
export function catalogReadersOver(fs: FileReader): CatalogReaders {
  const identities = catalogIdentityReader(fs);
  return { identities, checkSource: new CheckMarketplaceSource(fs, identities) };
}
