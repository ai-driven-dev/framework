import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PluginFetchError } from "../../../../src/contexts/distribution/domain/distribution.error.js";
import type { PluginFetcher } from "../../../../src/contexts/distribution/ports/plugin-fetcher.js";
import type { PluginSource } from "../../../../src/shared/domain/plugin/source.js";

/** The file every plugin the subject can fetch holds. */
export const PLUGIN_MANIFEST = join(".claude-plugin", "plugin.json");

export interface PluginFetcherSubject {
  readonly fetcher: PluginFetcher;
  readonly cacheDir: string;
  /** A remote the subject can serve, holding `PLUGIN_MANIFEST`. */
  readonly remote: PluginSource;
  /** A remote nothing answers for. */
  readonly unknownRemote: PluginSource;
  /** A plugin directory on this machine, holding `PLUGIN_MANIFEST`. */
  readonly localPath: string;
  dispose(): Promise<void>;
}

/**
 * Cases a subject is known to fail, each with the divergence it stands for. Such a case runs as
 * an expected failure: it goes red the day the subject is fixed, and the entry is then deleted.
 */
export interface KnownDivergences {
  readonly missingLocalPath?: string;
}

/** What fetching a plugin promises, whatever serves the source. */
export function describePluginFetcherContract(
  subjectName: string,
  makeSubject: () => Promise<PluginFetcherSubject>,
  knownDivergences: KnownDivergences = {}
): void {
  describe(`when a plugin is fetched ${subjectName}`, () => {
    const opened: PluginFetcherSubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.dispose();
    });

    async function given(): Promise<PluginFetcherSubject> {
      const subject = await makeSubject();
      opened.push(subject);
      return subject;
    }

    it("hands back the directory of a remote plugin, with its files in it", async () => {
      const { fetcher, cacheDir, remote } = await given();

      const directory = await fetcher.fetch(remote, cacheDir);

      expect(existsSync(join(directory, PLUGIN_MANIFEST))).toBe(true);
    });

    it("hands back the same directory when the plugin is asked for again", async () => {
      const { fetcher, cacheDir, remote } = await given();
      const first = await fetcher.fetch(remote, cacheDir);

      expect(await fetcher.fetch(remote, cacheDir)).toBe(first);
    });

    it("still hands back the plugin when a fresh copy is forced", async () => {
      const { fetcher, cacheDir, remote } = await given();
      await fetcher.fetch(remote, cacheDir);

      const directory = await fetcher.fetch(remote, cacheDir, { forceRefresh: true });

      expect(existsSync(join(directory, PLUGIN_MANIFEST))).toBe(true);
    });

    it("hands back a plugin already on this machine where it is", async () => {
      const { fetcher, cacheDir, localPath } = await given();

      expect(await fetcher.fetch({ kind: "local", path: localPath }, cacheDir)).toBe(localPath);
    });

    const missingLocal = knownDivergences.missingLocalPath === undefined ? it : it.fails;
    missingLocal("fails with a PluginFetchError for a local path that does not exist", async () => {
      const { fetcher, cacheDir, localPath } = await given();

      await expect(
        fetcher.fetch({ kind: "local", path: join(localPath, "absent") }, cacheDir)
      ).rejects.toThrow(PluginFetchError);
    });

    it("fails with a PluginFetchError for a remote nothing answers for", async () => {
      const { fetcher, cacheDir, unknownRemote } = await given();

      await expect(fetcher.fetch(unknownRemote, cacheDir)).rejects.toThrow(PluginFetchError);
    });
  });
}
