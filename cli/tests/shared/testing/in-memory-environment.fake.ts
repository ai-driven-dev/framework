import type { Environment } from "../../../src/shared/ports/environment.js";

export class InMemoryEnvironment implements Environment {
  private readonly values: Map<string, string>;

  constructor(initial: Readonly<Record<string, string>> = {}) {
    this.values = new Map(Object.entries(initial));
  }

  get(name: string): string | undefined {
    return this.values.get(name);
  }
}
