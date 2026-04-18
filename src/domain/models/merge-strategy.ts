export type PerKeyMergeStrategy = {
  default: "framework-prime" | "user-prime";
  frameworkPrimeKeys: readonly string[];
};

export type MergeStrategy = "none" | "framework-prime" | "user-prime" | PerKeyMergeStrategy;

export function isPerKeyMergeStrategy(s: MergeStrategy): s is PerKeyMergeStrategy {
  return typeof s === "object" && s !== null;
}
