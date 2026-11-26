import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentModelStore } from "../../../../src/contexts/installation/ports/agent-model-store.js";

export interface AgentModelStoreSubject {
  readonly store: AgentModelStore;
  dispose(): Promise<void>;
}

const RECORD = { path: "/p", written: { model: "x" }, previous: {}, created: true };

/** What the agent model store promises, stated once and run against every implementation of it. */
export function describeAgentModelStoreContract(
  subjectName: string,
  makeSubject: () => Promise<AgentModelStoreSubject>
): void {
  describe(`when the agent model store is ${subjectName}`, () => {
    let subject: AgentModelStoreSubject;
    beforeEach(async () => {
      subject = await makeSubject();
    });
    afterEach(async () => {
      await subject.dispose();
    });

    it("reads nothing as empty", async () => {
      expect(await subject.store.loadProviders()).toStrictEqual({});
      expect(await subject.store.loadMainModels()).toStrictEqual({});
    });

    it("reads back the providers saved", async () => {
      await subject.store.saveProviders({ claude: "anthropic" });

      expect(await subject.store.loadProviders()).toStrictEqual({ claude: "anthropic" });
    });

    it("reads back the main models saved, apart from the providers", async () => {
      await subject.store.saveMainModels({ claude: RECORD });

      expect(await subject.store.loadMainModels()).toStrictEqual({ claude: RECORD });
      expect(await subject.store.loadProviders()).toStrictEqual({});
    });

    it("reads back nothing once an empty set is saved over what was held", async () => {
      await subject.store.saveProviders({ claude: "anthropic" });
      await subject.store.saveProviders({});

      expect(await subject.store.loadProviders()).toStrictEqual({});
    });
  });
}
