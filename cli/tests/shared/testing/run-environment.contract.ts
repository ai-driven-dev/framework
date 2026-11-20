import { afterEach, describe, expect, it } from "vitest";
import type { Environment } from "../../../src/shared/ports/environment.js";

const SWITCH = "AIDD_ENVIRONMENT_CONTRACT_PROBE";

/** An implementation of the environment port holding exactly `values`, and what releases it. */
export interface EnvironmentSubject {
  readonly environment: Environment;
  dispose(): void;
}

/** What the environment port promises, stated once and run against every implementation of it. */
export function describeEnvironmentContract(
  subjectName: string,
  makeSubject: (values: Readonly<Record<string, string>>) => EnvironmentSubject
) {
  describe(`when the environment is ${subjectName}`, () => {
    let subject: EnvironmentSubject | undefined;
    afterEach(() => subject?.dispose());

    it("answers undefined for a switch nobody set", () => {
      subject = makeSubject({});

      expect(subject.environment.get(SWITCH)).toBeUndefined();
    });

    it("answers a switch that is set", () => {
      subject = makeSubject({ [SWITCH]: "on" });

      expect(subject.environment.get(SWITCH)).toBe("on");
    });

    it("answers an empty switch as empty, not as missing", () => {
      subject = makeSubject({ [SWITCH]: "" });

      expect(subject.environment.get(SWITCH)).toBe("");
    });
  });
}
