export type PerKeyMergeStrategy = {
  default: "framework-prime" | "user-prime";
  /** Keys where framework always wins, overriding the default strategy. */
  frameworkOverrideKeys: readonly string[];
};

export type MergeStrategy = "none" | "framework-prime" | "user-prime" | PerKeyMergeStrategy;

export function isPerKeyMergeStrategy(s: MergeStrategy): s is PerKeyMergeStrategy {
  return typeof s === "object" && s !== null;
}
