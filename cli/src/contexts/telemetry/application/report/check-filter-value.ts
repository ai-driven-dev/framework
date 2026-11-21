export interface CheckFilterValueCommand {
  readonly value: string;
  readonly choices?: readonly string[];
}

export type CheckFilterValueResult =
  | { readonly status: "valid"; readonly text: string }
  | { readonly status: "refused"; readonly reason: string };

/** What a person typed for one report filter: the value trimmed, and one of `choices` when the
 * filter has them. An empty value is refused. */
export class CheckFilterValue {
  execute({ value, choices }: CheckFilterValueCommand): CheckFilterValueResult {
    const text = value.trim();
    if (text === "") return { status: "refused", reason: "It is empty." };
    if (choices !== undefined && !choices.includes(text)) {
      return { status: "refused", reason: `Allowed choices are ${choices.join(", ")}.` };
    }
    return { status: "valid", text };
  }
}
