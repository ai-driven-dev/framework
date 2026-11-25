import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PluginClaimsRepository } from "../../../../src/contexts/machine-claims/ports/plugin-claims-repository.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";

export interface PluginClaimsSubject {
  readonly claims: PluginClaimsRepository;
  dispose(): Promise<void>;
}

const claude = [{ ref: "a@b", dependents: ["/project"] }];
const codex = [{ ref: "c@d", dependents: [] }];

/** What a scope's claims store promises, stated once and run against every implementation of it. */
export function describePluginClaimsContract(
  subjectName: string,
  makeSubject: () => Promise<PluginClaimsSubject>
): void {
  describe(`when the plugin claims are kept ${subjectName}`, () => {
    let subject: PluginClaimsSubject;
    beforeEach(async () => {
      subject = await makeSubject();
    });
    afterEach(async () => {
      await subject.dispose();
    });

    it("loads no claims before any is saved", async () => {
      expect(await subject.claims.load()).toStrictEqual(new Map());
    });

    it("loads back each tool's claims as they were saved", async () => {
      const saved = new Map<typeof TOOL.claude, unknown>([
        [TOOL.claude, claude],
        [TOOL.codex, codex],
      ]);

      await subject.claims.save(saved);

      expect(await subject.claims.load()).toStrictEqual(saved);
    });

    it("replaces what was kept on a save, never merging into it", async () => {
      await subject.claims.save(new Map([[TOOL.claude, claude]]));

      await subject.claims.save(new Map([[TOOL.codex, codex]]));

      expect(await subject.claims.load()).toStrictEqual(new Map([[TOOL.codex, codex]]));
    });

    it("keeps nothing once none is saved", async () => {
      await subject.claims.save(new Map([[TOOL.claude, claude]]));

      await subject.claims.save(new Map());

      expect(await subject.claims.load()).toStrictEqual(new Map());
    });
  });
}
