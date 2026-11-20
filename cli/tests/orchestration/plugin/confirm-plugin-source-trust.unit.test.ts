import { describe, expect, it } from "vitest";
import { TrustPluginSource } from "../../../src/contexts/distribution/application/plugin-source/trust-plugin-source.js";
import { ConfirmPluginSourceTrust } from "../../../src/orchestration/plugin/confirm-plugin-source-trust.js";
import { TrustDeniedError } from "../../../src/shared/domain/errors.js";
import { describePluginSource } from "../../../src/shared/domain/source.js";
import { InMemoryMarketplaceTrustStore } from "../../helpers/ports/in-memory-marketplace-trust-store.js";
import { KeepPrompter } from "../../shared/testing/scripted-prompter.fake.js";

const ROOT = "/project";
const SOURCE = { kind: "local" as const, path: "/plugins/one" };

class AnsweringPrompter extends KeepPrompter {
  readonly asked: string[] = [];
  constructor(private readonly answer: boolean) {
    super();
  }
  override async confirm(message: string): Promise<boolean> {
    this.asked.push(message);
    return this.answer;
  }
}

function build(answer: boolean) {
  const store = new InMemoryMarketplaceTrustStore();
  const prompter = new AnsweringPrompter(answer);
  const confirm = new ConfirmPluginSourceTrust(new TrustPluginSource(store), prompter);
  return { store, prompter, confirm };
}

describe("ConfirmPluginSourceTrust", () => {
  it("asks about an unknown source and trusts it once confirmed", async () => {
    const { store, prompter, confirm } = build(true);

    await confirm.execute({ projectRoot: ROOT, source: SOURCE });

    expect(prompter.asked).toEqual([`Trust plugin source '${describePluginSource(SOURCE)}'?`]);
    expect(await store.isTrusted(ROOT, SOURCE)).toBe(true);
  });

  it("throws TrustDeniedError and trusts nothing when denied", async () => {
    const { store, confirm } = build(false);

    await expect(confirm.execute({ projectRoot: ROOT, source: SOURCE })).rejects.toThrow(
      TrustDeniedError
    );
    expect(await store.isTrusted(ROOT, SOURCE)).toBe(false);
  });

  it("asks nothing for a source already trusted", async () => {
    const { store, prompter, confirm } = build(false);
    await store.trust(ROOT, SOURCE);

    await confirm.execute({ projectRoot: ROOT, source: SOURCE });

    expect(prompter.asked).toEqual([]);
  });
});
