/** Why the host's own CLI did not carry out a call: its reason, as it said it. */
export interface NativeRefusal {
  readonly detail: string;
}

/** What a call into the host's own CLI answers: `undefined` when it ran to completion, else the
 * refusal naming why not. Returned, never thrown: a caller that lets it travel says so with
 * `throwRefusal`. */
export type HostRefusal = NativeRefusal | undefined;
