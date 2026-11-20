import { afterEach, describe, expect, it } from "vitest";
import type { CliAuthProvider } from "../../../../src/contexts/auth/ports/cli-auth-provider.js";
import { AuthenticationError } from "../../../../src/shared/domain/errors.js";

/** What one scenario asks of a subject: the provider as it behaves with this on the machine. */
export type CliScenario =
  /** The tool answers this token and this login. */
  | { kind: "signed-in"; token: string; login: string }
  /** The tool is not installed. */
  | { kind: "absent" }
  /** The tool is installed and fails. */
  | { kind: "failing" };

export interface CliSubject {
  readonly provider: CliAuthProvider;
  dispose(): Promise<void>;
}

/**
 * What a command-line credential provider promises, in the three situations a machine can be
 * in. The wording of what the tool printed is the adapter's translation, tested there.
 */
export function describeCliAuthProviderContract(
  subjectName: string,
  makeSubject: (scenario: CliScenario) => Promise<CliSubject>
): void {
  describe(`when the command-line auth provider is ${subjectName}`, () => {
    const opened: CliSubject[] = [];

    afterEach(async () => {
      // Last opened, first disposed: a subject that rewrote a shared setting restores it in turn.
      for (const subject of opened.splice(0).reverse()) await subject.dispose();
    });

    async function given(scenario: CliScenario): Promise<CliAuthProvider> {
      const subject = await makeSubject(scenario);
      opened.push(subject);
      return subject.provider;
    }

    it("answers the token the tool holds", async () => {
      const provider = await given({ kind: "signed-in", token: "ghp_cli", login: "octocat" });

      expect(provider.read()).toBe("ghp_cli");
    });

    it("answers no token when the tool is not installed", async () => {
      expect((await given({ kind: "absent" })).read()).toBeNull();
    });

    it("fails rather than answer no token when the tool fails", async () => {
      const provider = await given({ kind: "failing" });

      expect(() => provider.read()).toThrow();
    });

    it("answers the login the tool reports", async () => {
      const provider = await given({ kind: "signed-in", token: "ghp_cli", login: "octocat" });

      expect(await provider.verify()).toBe("octocat");
    });

    it("refuses to verify when the tool is absent or fails", async () => {
      for (const kind of ["absent", "failing"] as const) {
        const provider = await given({ kind });
        await expect(provider.verify()).rejects.toThrow(new AuthenticationError("gh CLI"));
      }
    });
  });
}
