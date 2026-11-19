/** What the registration policy decides: go on with the proof that justified it, or refuse for a
 * reason, naming what a person must reconcile. The caller turns a refusal into its own message. */
export type Verdict<Evidence, Reason extends string> =
  | { readonly outcome: "proceed"; readonly evidence: Evidence }
  | {
      readonly outcome: "refuse";
      readonly reason: Reason;
      readonly reconcile: string | undefined;
    };
