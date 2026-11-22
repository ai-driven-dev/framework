/** Why the host's own CLI did not carry out a call: its reason, as it said it. */
export interface NativeRefusal {
  readonly detail: string;
}
