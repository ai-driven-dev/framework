import { expect } from "vitest";
import type { Lock } from "../../../src/shared/ports/lock.js";

/** A repository holding one record in memory, counting its saves. Exclusive access is granted
 * at once: nothing else contends for it. */
export class InMemoryRepository<Held> implements Lock {
  saveCount = 0;
  protected record: Held | null;

  constructor(seed: Held | null = null) {
    this.record = seed;
  }

  async load(): Promise<Held | null> {
    return this.record;
  }

  async save(record: Held): Promise<void> {
    this.saveCount += 1;
    this.record = record;
  }

  withExclusiveAccess<T>(action: () => Promise<T>): Promise<T> {
    return action();
  }

  getCurrent(): Held | null {
    return this.record;
  }
}

/** The repository's `load` and `withExclusiveAccess`, `load` failing any call made outside the
 * exclusive access. */
export function loadsOnlyUnderLock<Held>(
  repo: InMemoryRepository<Held>
): Pick<InMemoryRepository<Held>, "load" | "withExclusiveAccess"> {
  let entered = false;
  return {
    load: () => {
      expect(entered).toBe(true);
      return repo.load();
    },
    withExclusiveAccess: async (action) => {
      entered = true;
      try {
        return await action();
      } finally {
        entered = false;
      }
    },
  };
}
