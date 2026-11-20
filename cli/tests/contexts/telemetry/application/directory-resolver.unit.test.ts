import { describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../src/contexts/telemetry/application/directory-resolver.js";
import { cloneKey } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { cloneOf, grantedBy, tokenOf } from "../testing/clone.builder.js";
import { FakeConsents } from "../testing/fake-consents.fake.js";
import { FakeLocator } from "../testing/fake-locator.fake.js";
import { InMemoryConsentHistory } from "../testing/in-memory-consent-history.fake.js";
import { InMemoryResolutions } from "../testing/in-memory-resolutions.fake.js";
import { A, NOW, repository } from "../testing/ingest-usage-setup.builder.js";

function world() {
  const locator = new FakeLocator();
  const consents = new FakeConsents();
  const resolutions = new InMemoryResolutions();
  const history = new InMemoryConsentHistory();
  const resolver = new DirectoryResolver(locator, consents, resolutions, history, {
    caseInsensitiveFileSystem: false,
    now: () => NOW,
  });
  return { locator, consents, resolutions, history, resolver };
}

describe("a run of the directory resolver", () => {
  it("hands over what its work answers", async () => {
    const { resolver } = world();
    expect(await resolver.execute(async () => "answer")).toBe("answer");
  });

  it("closes, at the run's moment, an interval whose clone no longer names its token", async () => {
    const { resolver, history, consents } = world();
    history.consented(A);
    consents.cloneSays(A, "off");
    await resolver.execute(async () => undefined);
    expect(history.written.at(-1)).toEqual({
      kind: "close",
      token: tokenOf(A),
      at: NOW.toISOString(),
    });
  });

  it("keeps an interval whose clone still names its token, and one with nothing at its path", async () => {
    const { resolver, history, consents } = world();
    const gone = cloneOf("/work/gone/.git");
    history.consented(A);
    history.consented(gone);
    consents.cloneSays(A, grantedBy(A));
    await resolver.execute(async () => undefined);
    expect(history.written).toHaveLength(2);
  });

  it("neither keeps nor closes an interval of a clone it cannot read", async () => {
    const { resolver, history, consents, locator } = world();
    history.consented(A);
    consents.unreadableClones.add(cloneKey(A));
    locator.directories.set("/work/a", repository("/work/a"));
    const outcome = await resolver.execute((run) => run.resolve("/work/a", NOW.toISOString()));
    expect(history.written).toHaveLength(1);
    expect(outcome).toEqual({ skipped: "unreadable-consent", mayConsent: true });
  });

  it("keeps what the run learned once its work is done, and only when it learned something", async () => {
    const { resolver, locator, history, resolutions } = world();
    history.consented(A);
    locator.directories.set("/work/a", repository("/work/a"));
    await resolver.execute(async (run) => {
      await run.resolve("/work/a", NOW.toISOString());
      expect(resolutions.saves).toBe(0);
    });
    expect(resolutions.saves).toBe(1);
    await resolver.execute((run) => run.resolve("/work/a", NOW.toISOString()));
    expect(resolutions.saves).toBe(1);
  });
});
