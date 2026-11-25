import { afterEach, describe, expect, it } from "vitest";
import type { RawCatalogFetcher } from "../../../../src/contexts/distribution/ports/raw-catalog-fetcher.js";
import type { PluginSourceGitHub } from "../../../../src/shared/domain/plugin/source.js";
import {
  CatalogFetchAuthError,
  CatalogFetchNotFoundError,
} from "../../../../src/shared/domain/shared.error.js";

export const CATALOG_PATH = ".claude-plugin/marketplace.json";

/** A catalog as the forge holds it, in the format the published schema describes. */
function catalogNamed(name: string): string {
  return JSON.stringify({
    name,
    plugins: [
      { name: `${name}-plugin`, source: `./plugins/${name}`, description: name, version: "1.0.0" },
    ],
  });
}

export const HEAD_CATALOG = catalogNamed("head");
export const STABLE_CATALOG = catalogNamed("stable");

/** The world every subject serves: a public repository with a `stable` ref, a private one. */
export const PUBLIC_REPO = "owner/public";
export const PRIVATE_REPO = "owner/private";
export const STABLE_REF = "stable";

/** The forge of that world, as the in-memory double answers it. */
export function contractWorld(source: PluginSourceGitHub, catalogPath: string): string {
  if (source.repo === PRIVATE_REPO) throw new CatalogFetchAuthError(source.repo);
  if (source.repo !== PUBLIC_REPO || catalogPath !== CATALOG_PATH) {
    throw new CatalogFetchNotFoundError(source.repo);
  }
  if (source.ref === undefined || source.ref === "HEAD") return HEAD_CATALOG;
  if (source.ref === STABLE_REF) return STABLE_CATALOG;
  return HEAD_CATALOG;
}

export interface RawCatalogSubject {
  readonly fetcher: RawCatalogFetcher;
  dispose(): Promise<void>;
}

/** What reading a catalog file from a forge promises, whatever answers for it. */
export function describeRawCatalogContract(
  subjectName: string,
  makeSubject: () => Promise<RawCatalogSubject>
): void {
  describe(`when a raw catalog is read ${subjectName}`, () => {
    const opened: RawCatalogSubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.dispose();
    });

    async function given(): Promise<RawCatalogFetcher> {
      const subject = await makeSubject();
      opened.push(subject);
      return subject.fetcher;
    }

    it("answers the catalog at the default ref when none is asked", async () => {
      const fetcher = await given();

      const body = await fetcher.fetchCatalog({ kind: "github", repo: PUBLIC_REPO }, CATALOG_PATH);

      expect(body).toBe(HEAD_CATALOG);
    });

    it("answers the catalog at the ref asked", async () => {
      const fetcher = await given();

      const body = await fetcher.fetchCatalog(
        { kind: "github", repo: PUBLIC_REPO, ref: STABLE_REF },
        CATALOG_PATH
      );

      expect(body).toBe(STABLE_CATALOG);
    });

    it("falls back to the default ref when the ref asked does not exist", async () => {
      const fetcher = await given();

      const body = await fetcher.fetchCatalog(
        { kind: "github", repo: PUBLIC_REPO, ref: "missing" },
        CATALOG_PATH
      );

      expect(body).toBe(HEAD_CATALOG);
    });

    it("refuses with a not-found error when the repository is unknown", async () => {
      const fetcher = await given();

      await expect(
        fetcher.fetchCatalog({ kind: "github", repo: "owner/unknown" }, CATALOG_PATH)
      ).rejects.toBeInstanceOf(CatalogFetchNotFoundError);
    });

    it("refuses with a not-found error when the file is absent", async () => {
      const fetcher = await given();

      await expect(
        fetcher.fetchCatalog({ kind: "github", repo: PUBLIC_REPO }, "absent.json")
      ).rejects.toBeInstanceOf(CatalogFetchNotFoundError);
    });

    it("refuses with an authentication error when the repository needs credentials", async () => {
      const fetcher = await given();

      await expect(
        fetcher.fetchCatalog({ kind: "github", repo: PRIVATE_REPO }, CATALOG_PATH)
      ).rejects.toBeInstanceOf(CatalogFetchAuthError);
    });
  });
}
