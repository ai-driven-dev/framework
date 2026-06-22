import { CodexCliError } from "../../../src/domain/errors.js";
import type { CodexActivator } from "../../../src/domain/ports/codex-activator.js";

/**
 * Records `codex` CLI activation calls instead of shelling out.
 * Defaults to unavailable so unit deps skip activation unless a test opts in.
 * `failOnPlugins` makes `enablePlugin` throw for the listed refs (simulates a
 * plugin missing from the marketplace snapshot).
 */
export class FakeCodexActivator implements CodexActivator {
  available: boolean;
  readonly addedMarketplaces: string[] = [];
  readonly enabledPlugins: string[] = [];
  upgradeCount = 0;
  private readonly failOnPlugins: ReadonlySet<string>;

  constructor(options: { available?: boolean; failOnPlugins?: readonly string[] } = {}) {
    this.available = options.available ?? false;
    this.failOnPlugins = new Set(options.failOnPlugins ?? []);
  }

  isAvailable(): boolean {
    return this.available;
  }

  addMarketplace(source: string): void {
    this.addedMarketplaces.push(source);
  }

  upgradeMarketplaces(): void {
    this.upgradeCount += 1;
  }

  enablePlugin(pluginRef: string): void {
    if (this.failOnPlugins.has(pluginRef)) {
      throw new CodexCliError(`plugin \`${pluginRef}\` was not found in marketplace`);
    }
    this.enabledPlugins.push(pluginRef);
  }
}
