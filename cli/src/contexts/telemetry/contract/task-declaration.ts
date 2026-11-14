export const DECLARED_BY = ["command", "hook-intercept"] as const;
export type DeclaredBy = (typeof DECLARED_BY)[number];

export type DeclarationRequest =
  | { readonly kind: "task"; readonly task: string; readonly ticket: string | null }
  | { readonly kind: "none" };
