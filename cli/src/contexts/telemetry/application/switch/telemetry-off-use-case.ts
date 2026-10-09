import type { ConsentSource } from "../../domain/ports/consent-source.js";
import type { RepositoryLocator } from "../../domain/ports/repository-locator.js";
import type { ProjectConfigWriter } from "../../domain/ports/switch/project-config-writer.js";
import { switchedOff } from "../../domain/switch/consent-switch.js";

export type OffResult =
  | { readonly status: "refused"; readonly reason: "outside-repository" | "unreadable-config" }
  | { readonly status: "off"; readonly changed: boolean };

/** Stops reading this repository. What was already measured stays until `forget`. */
export class TelemetryOffUseCase {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consents: ConsentSource,
    private readonly config: ProjectConfigWriter
  ) {}

  async execute(cwd: string): Promise<OffResult> {
    const located = await this.locator.locate(cwd);
    if (located.status !== "repository") return { status: "refused", reason: "outside-repository" };
    const switched = switchedOff(await this.consents.read(located.root));
    if (switched.status === "unreadable") return { status: "refused", reason: "unreadable-config" };
    if (switched.status === "unchanged") return { status: "off", changed: false };
    await this.config.write(located.root, switched.text);
    return { status: "off", changed: true };
  }
}
