/** What the registration policy decides: go on with the proof that justified it, skip because
 * the work is already done or not this project's to do, or refuse for a reason, naming what a
 * person must reconcile. The caller turns a refusal into its own message. */
export type Verdict<Evidence, Reason extends string, Skipped extends string = never> =
  | { readonly outcome: "proceed"; readonly evidence: Evidence }
  | ([Skipped] extends [never] ? never : { readonly outcome: "skip"; readonly reason: Skipped })
  | ([Reason] extends [never]
      ? never
      : {
          readonly outcome: "refuse";
          readonly reason: Reason;
          readonly reconcile: string | undefined;
        });
