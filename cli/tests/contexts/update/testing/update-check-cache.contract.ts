import { afterEach, describe, expect, it } from "vitest";
import type { CheckEntry } from "../../../../src/contexts/update/domain/update-notice.js";
import type { UpdateCheckCache } from "../../../../src/contexts/update/ports/update-check-cache.js";

export interface CacheSubject {
  readonly cache: UpdateCheckCache;
  /** Leaves what an earlier release of the CLI kept, where it kept it. */
  keepFromEarlierRelease(entry: CheckEntry): Promise<void>;
  /** Leaves something that is not an entry. */
  keepUnreadable(): Promise<void>;
  dispose(): Promise<void>;
}

const ENTRY: CheckEntry = { checkedAt: 1000, latest: "2.0.0" };

/** What the place a check's answer is kept between two runs promises. */
export function describeUpdateCheckCacheContract(
  subjectName: string,
  makeSubject: () => Promise<CacheSubject>
): void {
  describe(`when the update check cache is ${subjectName}`, () => {
    const opened: CacheSubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.dispose();
    });

    async function given(): Promise<CacheSubject> {
      const subject = await makeSubject();
      opened.push(subject);
      return subject;
    }

    it("answers nothing before anything was kept", async () => {
      expect(await (await given()).cache.read()).toBeNull();
    });

    it("answers what was last written", async () => {
      const { cache } = await given();
      await cache.write({ checkedAt: 1, latest: "1.0.0" });
      await cache.write(ENTRY);

      expect(await cache.read()).toStrictEqual(ENTRY);
    });

    it("answers what an earlier release kept, until something is written", async () => {
      const subject = await given();
      await subject.keepFromEarlierRelease({ checkedAt: 5, latest: "1.5.0" });

      expect(await subject.cache.read()).toStrictEqual({ checkedAt: 5, latest: "1.5.0" });

      await subject.cache.write(ENTRY);
      expect(await subject.cache.read()).toStrictEqual(ENTRY);
    });

    it("answers nothing when what was kept is unreadable", async () => {
      const subject = await given();
      await subject.keepUnreadable();

      expect(await subject.cache.read()).toBeNull();
    });
  });
}
