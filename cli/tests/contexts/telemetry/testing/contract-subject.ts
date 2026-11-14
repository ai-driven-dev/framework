import { afterEach, beforeEach, describe } from "vitest";

/** What a contract run owns: one implementation of a port, and what releases it. */
export interface ContractSubject {
  dispose(): Promise<void>;
}

/** One subject per case, made fresh and disposed after it; `cases` reads it through `subject()`. */
export function describeSubject<S extends ContractSubject>(
  title: string,
  makeSubject: () => Promise<S>,
  cases: (subject: () => S) => void
): void {
  describe(title, () => {
    let subject: S;
    beforeEach(async () => {
      subject = await makeSubject();
    });
    afterEach(async () => {
      await subject.dispose();
    });
    cases(() => subject);
  });
}
