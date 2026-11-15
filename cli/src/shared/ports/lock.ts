/** An inter-process lock around a read-modify-write of machine-wide state, so two AIDD runs on
 * one machine never interleave their writes. */
export interface Lock {
  withExclusiveAccess<T>(action: () => Promise<T>): Promise<T>;
}
