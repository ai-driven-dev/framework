import { DisableTelemetry } from "../../../../src/contexts/telemetry/application/switch/disable-telemetry.use-case.js";

import { EnableTelemetry } from "../../../../src/contexts/telemetry/application/switch/enable-telemetry.use-case.js";
import { GrantConsent } from "../../../../src/contexts/telemetry/application/switch/grant-consent.use-case.js";
import { ReadCloneConsent } from "../../../../src/contexts/telemetry/application/switch/read-clone-consent.use-case.js";
import { RememberOwnRoot } from "../../../../src/contexts/telemetry/application/switch/remember-own-root.use-case.js";
import { WithdrawConsent } from "../../../../src/contexts/telemetry/application/switch/withdraw-consent.use-case.js";
import type { RepositoryResolution } from "../../../../src/contexts/telemetry/domain/repository-resolution.js";
import type { LocatedDirectory } from "../../../../src/contexts/telemetry/domain/resolution/located-directory.js";
import { cloneOf } from "./clone.builder.js";
import { FakeConsents } from "./fake-consents.fake.js";
import { FakeLocator } from "./fake-locator.fake.js";
import { InMemoryConsentHistory } from "./in-memory-consent-history.fake.js";
import { InMemoryIdentity } from "./in-memory-identity.fake.js";
import { InMemoryLedger } from "./in-memory-ledger.fake.js";
import { InMemoryResolutions } from "./in-memory-resolutions.fake.js";

export const repository = (
  root: string,
  mainRoot = root,
  extra: { remote?: string | null; rootCommit?: string | null } = {}
): Extract<LocatedDirectory, { status: "repository" }> => ({
  status: "repository",
  root,
  mainRoot,
  clone: cloneOf(`${mainRoot}/.git`),
  remote: "r",
  rootCommit: "c",
  ...extra,
});

export const ID = "c";
export const MAIN = cloneOf("/w/main/.git");
export const T1 = "2026-10-01T00:00:00.000Z";
export const T2 = "2026-10-02T00:00:00.000Z";
export const T3 = "2026-10-03T00:00:00.000Z";

/** A working tree that is gone, as ingest remembered it in `clone`. */
export function deleted(clone = MAIN, dir = "/gone/x"): RepositoryResolution {
  return { dir, repository_id: ID, root: dir, clone, seen_at: "2026-09-01T00:00:00.000Z" };
}

export function setup() {
  const events: string[] = [];
  let minted = 0;
  const locator = new FakeLocator();
  const consents = new FakeConsents();
  const ledger = new InMemoryLedger(events);
  const resolutions = new InMemoryResolutions();
  const history = new InMemoryConsentHistory();
  const clock = { now: new Date(T1) };
  const writes: { root: string; value: string }[] = [];
  const identities = new InMemoryIdentity();
  const writer = {
    async set(root: string, value: string) {
      events.push("consent");
      writes.push({ root, value });
      consents.values.set(root, value);
      const located = await locator.locate(root);
      if (located.status === "repository" && located.clone !== null) {
        consents.cloneSays(located.clone, value);
      }
    },
  };
  const grant = new GrantConsent({
    consents,
    writer,
    history: history,
    ledger,
    newInterval: () => ({
      token: `tok-${++minted}`,
      at: clock.now,
    }),
  });
  const withdraw = new WithdrawConsent({
    writer,
    history: history,
    ledger,
    now: () => clock.now,
  });
  const cloneConsent = new ReadCloneConsent(locator, consents);
  const on = new EnableTelemetry({
    cloneConsent,
    grant,
    roots: new RememberOwnRoot(ledger, resolutions, {
      caseInsensitiveFileSystem: false,
      now: () => clock.now,
    }),
    identities,
  });
  const off = new DisableTelemetry(cloneConsent, withdraw);
  locator.directories.set("/w/repo", repository("/w/repo", "/w/main"));
  return {
    on,
    off,
    grant,
    withdraw,
    locator,
    consents,
    ledger,
    resolutions,
    history,
    clock,
    writes,
    events,
    identities,
  };
}
