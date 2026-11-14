import type {
  BindingsLock,
  LockWait,
} from "../../../../src/contexts/telemetry/ports/bindings/bindings-lock.js";

export class InMemoryBindingsLock implements BindingsLock {
  /** Pass one array to several fakes to see the order they were used in. */
  constructor(readonly events: string[] = []) {}

  /** The wait each use asked for: `undefined` is the lock's own. */
  readonly waits: (number | undefined)[] = [];

  async exclusively<T>(work: () => Promise<T>, wait?: LockWait): Promise<T> {
    this.waits.push(wait?.waitMs);
    this.events.push("bindings-lock");
    try {
      return await work();
    } finally {
      this.events.push("bindings-unlock");
    }
  }
}
