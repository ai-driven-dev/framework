import { expect, it } from "vitest";
import {
  type RepositoryResolution,
  resolutionKey,
} from "../../../../src/contexts/telemetry/domain/repository-resolution.js";
import type { ResolutionStore } from "../../../../src/contexts/telemetry/ports/resolution-store.js";
import { cloneOf } from "./clone.builder.js";
import { type ContractSubject, describeSubject } from "./contract-subject.builder.js";

export interface ResolutionStoreSubject extends ContractSubject {
  readonly store: ResolutionStore;
}

/** The held resolutions, each under the key the store knows it by. */
function held(...resolutions: RepositoryResolution[]): Map<string, RepositoryResolution> {
  return new Map(resolutions.map((entry) => [resolutionKey(entry.dir, entry.clone), entry]));
}

function resolution(overrides: Partial<RepositoryResolution> = {}): RepositoryResolution {
  return {
    dir: "/work/app",
    repository_id: "r1",
    root: "/work/app",
    clone: cloneOf("/work/app/.git"),
    seen_at: "2026-10-07T10:00:00.000Z",
    ...overrides,
  };
}

/** What the resolution store promises, stated once and run against every implementation. */
export function describeResolutionStoreContract(
  subjectName: string,
  makeSubject: () => Promise<ResolutionStoreSubject>
): void {
  describeSubject(`when the resolution store is ${subjectName}`, makeSubject, (subject) => {
    it("holds nothing before the first save", async () => {
      expect((await subject().store.load()).size).toBe(0);
    });

    it("reads back what was saved, each under the key of its directory and clone", async () => {
      const app = resolution();
      const lib = resolution({ dir: "/work/lib", repository_id: "r2", root: "/work/lib" });
      await subject().store.save(held(app, lib));

      expect(await subject().store.load()).toEqual(held(app, lib));
    });

    it("keeps the clone a directory belonged to, birth time and all", async () => {
      const clone = cloneOf("/work/app/.git", { dev: "9", ino: "42", birthtimeMs: 123_456 });
      const saved = resolution({ clone });
      await subject().store.save(held(saved));

      expect([...(await subject().store.load()).values()][0]?.clone).toEqual(clone);
    });

    it("keeps the two clones a directory has had apart", async () => {
      const old = resolution({ clone: cloneOf("/work/app/.git", { ino: "1" }) });
      const fresh = resolution({ clone: cloneOf("/work/app/.git", { ino: "2" }) });
      await subject().store.save(held(old, fresh));

      expect((await subject().store.load()).size).toBe(2);
    });

    it("holds only what the last save said, never what an earlier one said", async () => {
      await subject().store.save(held(resolution()));
      const later = resolution({ dir: "/work/lib", root: "/work/lib" });
      await subject().store.save(held(later));

      expect(await subject().store.load()).toEqual(held(later));
    });

    it("answers a copy: changing what was loaded changes nothing it holds", async () => {
      await subject().store.save(held(resolution()));
      (await subject().store.load()).clear();

      expect((await subject().store.load()).size).toBe(1);
    });
  });
}
