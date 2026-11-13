import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IdentityVerifier } from "../../../../src/contexts/auth/ports/identity-verifier.js";
import { AuthenticationError } from "../../../../src/shared/domain/errors.js";

/** What a contract run needs from one implementation of the identity check. */
export interface VerifierSubject {
  readonly verifier: IdentityVerifier;
  /** A token the subject knows, and the login it answers for it. */
  readonly knownToken: string;
  readonly login: string;
  /** A token the subject refuses. */
  readonly refusedToken: string;
  dispose(): Promise<void>;
}

/**
 * What the identity check promises: a known token answers its login, any other is refused with
 * the one authentication error, and the refusal never carries the token. How a service words
 * a body or a status is the adapter's translation and has its own test.
 */
export function describeIdentityVerifierContract(
  subjectName: string,
  makeSubject: () => Promise<VerifierSubject>
): void {
  describe(`when the identity verifier is ${subjectName}`, () => {
    let subject: VerifierSubject;

    beforeEach(async () => {
      subject = await makeSubject();
    });

    afterEach(async () => {
      await subject.dispose();
    });

    it("answers the login of a token it knows", async () => {
      expect(await subject.verifier.verifyToken(subject.knownToken)).toBe(subject.login);
    });

    it("refuses a token it does not know with the authentication error", async () => {
      await expect(subject.verifier.verifyToken(subject.refusedToken)).rejects.toThrow(
        new AuthenticationError("GitHub API")
      );
    });

    it("never carries the refused token in its refusal", async () => {
      const refusal = await subject.verifier.verifyToken(subject.refusedToken).then(
        () => "",
        (error: unknown) => String((error as Error).stack ?? error)
      );

      expect(refusal.includes(subject.refusedToken)).toBe(false);
    });
  });
}
