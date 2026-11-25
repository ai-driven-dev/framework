import type { BindingsLock } from "../../../../src/contexts/telemetry/ports/bindings/bindings-lock.js";

export class InMemoryBindingsLock implements BindingsLock {
  /** Pass one array to several fakes to see the order they were used in. */
  constructor(readonly events: string[] = []) {}

  /** The turn of the writer ahead: one at a time, as the real lock lets them in. */
  private turn: Promise<unknown> = Promise.resolve();

  async exclusively<T>(work: () => Promise<T>): Promise<T> {
    const run = this.turn.then(async () => {
      this.events.push("bindings-lock");
      try {
        return await work();
      } finally {
        this.events.push("bindings-unlock");
      }
    });
    this.turn = run.catch(() => undefined);
    return run;
  }
}
