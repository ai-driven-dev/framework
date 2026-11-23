import { DirectoryResolver } from "../../../../src/contexts/telemetry/application/directory-resolver.use-case.js";
import {
  type ResolutionEnvironment,
  resolutionRunOf,
} from "../../../../src/contexts/telemetry/application/resolution-run.js";
import type { ConsentHistory } from "../../../../src/contexts/telemetry/ports/consent-history.js";
import type { ConsentSource } from "../../../../src/contexts/telemetry/ports/consent-source.js";
import type { RepositoryLocator } from "../../../../src/contexts/telemetry/ports/repository-locator.js";
import type { ResolutionStore } from "../../../../src/contexts/telemetry/ports/resolution-store.js";

/** A resolver wired as composition wires it, over the given machine and stores. */
export function directoryResolverOf(machine: {
  readonly locator: RepositoryLocator;
  readonly consentSource: ConsentSource;
  readonly store: ResolutionStore;
  readonly history: ConsentHistory;
  readonly environment: ResolutionEnvironment;
}): DirectoryResolver {
  const { locator, consentSource, environment } = machine;
  return new DirectoryResolver({
    consentSource,
    store: machine.store,
    history: machine.history,
    startRun: resolutionRunOf(locator, consentSource, environment),
    now: environment.now,
  });
}
