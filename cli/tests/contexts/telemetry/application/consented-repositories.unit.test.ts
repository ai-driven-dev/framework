import { describe, expect, it } from "vitest";
import { ConsentedRepositories } from "../../../../src/contexts/telemetry/application/consented-repositories.js";
import { repositoryIdOf } from "../../../../src/contexts/telemetry/domain/repository-identity.js";
import {
  CONSENT_WITHDRAWN,
  consentValue,
} from "../../../../src/contexts/telemetry/domain/telemetry-consent.js";
import type { LocatedDirectory } from "../../../../src/contexts/telemetry/ports/repository-locator.js";
import { grantedBy, tokenOf } from "../testing/clone.builder.js";
import { FakeConsents } from "../testing/fake-consents.fake.js";
import { FakeLocator } from "../testing/fake-locator.fake.js";
import { InMemoryConsentHistory } from "../testing/in-memory-consent-history.fake.js";
import { repository } from "../testing/ingest-usage-setup.builder.js";

const ROOT = "/work/a";
const OPENED = "2026-10-01T00:00:00.000Z";

function setup(located: LocatedDirectory = repository(ROOT)) {
  const locator = new FakeLocator();
  locator.directories.set(ROOT, located);
  const consents = new FakeConsents();
  const history = new InMemoryConsentHistory();
  const open = () => new ConsentedRepositories(locator, consents, history).open(ROOT);
  return { consents, history, open, located };
}

const refused = (reason: string) => ({ status: "refused", reason });

describe("ConsentedRepositories", () => {
  it("opens the repository whose key names an interval open for its clone", async () => {
    const { consents, history, open, located } = setup();
    if (located.status !== "repository" || located.clone === null) throw new Error("setup");
    history.consented(located.clone, OPENED);
    consents.values.set(ROOT, grantedBy(located.clone));
    expect(await open()).toEqual({
      status: "open",
      repositoryId: repositoryIdOf(located),
      root: ROOT,
      since: OPENED,
    });
  });

  it("refuses a directory outside any repository", async () => {
    expect(await setup({ status: "outside-repository" }).open()).toEqual(
      refused("outside-repository")
    );
  });

  it("refuses a directory git would not answer for as unreadable", async () => {
    expect(await setup({ status: "unreadable" }).open()).toEqual(refused("unreadable-consent"));
  });

  it("refuses a repository with no origin and no commit to be named by", async () => {
    const located = repository(ROOT, { remote: null, rootCommit: null });
    expect(await setup(located).open()).toEqual(refused("unidentified-repository"));
  });

  it("refuses a clone whose key cannot be read", async () => {
    const { consents, open } = setup();
    consents.unreadable.add(ROOT);
    expect(await open()).toEqual(refused("unreadable-consent"));
  });

  it("refuses a clone that never asked to be measured", async () => {
    expect(await setup().open()).toEqual(refused("no-consent"));
  });

  it("tells a clone that was turned off", async () => {
    const { consents, open } = setup();
    consents.values.set(ROOT, CONSENT_WITHDRAWN);
    expect(await open()).toEqual(refused("turned-off"));
  });

  it("refuses everything while the consent log cannot be read", async () => {
    const { consents, history, open, located } = setup();
    if (located.status !== "repository" || located.clone === null) throw new Error("setup");
    consents.values.set(ROOT, grantedBy(located.clone));
    history.damaged = true;
    expect(await open()).toEqual(refused("unreadable-consent"));
  });

  it("refuses a key that names no interval open for the clone", async () => {
    const { consents, history, open, located } = setup();
    if (located.status !== "repository" || located.clone === null) throw new Error("setup");
    history.consented(located.clone, OPENED);
    history.written.push({ kind: "close", token: tokenOf(located.clone), at: OPENED });
    consents.values.set(ROOT, grantedBy(located.clone));
    expect(await open()).toEqual(refused("no-consent"));
  });

  it("refuses a key whose token is not the one open for the clone", async () => {
    const { consents, history, open, located } = setup();
    if (located.status !== "repository" || located.clone === null) throw new Error("setup");
    history.consented(located.clone, OPENED);
    consents.values.set(ROOT, consentValue("copied-from-elsewhere"));
    expect(await open()).toEqual(refused("no-consent"));
  });
});
