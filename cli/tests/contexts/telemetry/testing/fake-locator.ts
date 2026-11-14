import type {
  LocatedDirectory,
  RepositoryLocator,
} from "../../../../src/contexts/telemetry/ports/repository-locator.js";

export class FakeLocator implements RepositoryLocator {
  readonly directories = new Map<string, LocatedDirectory>();
  readonly asked: string[] = [];

  async locate(cwd: string): Promise<LocatedDirectory> {
    this.asked.push(cwd);
    return this.directories.get(cwd) ?? { status: "gone" };
  }
}
