export type ErasureKind =
  | "ledger"
  | "bindings"
  | "identity"
  | "previous-day-file"
  | "previous-identity";

export interface ErasureEntry {
  readonly kind: ErasureKind;
  readonly path: string;
  /** Files that go with it: a directory counts what it holds. */
  readonly files: number;
}

/** Everything measurement keeps on the machine, outside any repository. */
export interface MeasurementErasure {
  /** What is there now. Reads only, and creates nothing. */
  inventory(): Promise<readonly ErasureEntry[]>;
  /** Removes what `inventory` names, and takes no path: nothing else can be asked to go. */
  erase(): Promise<void>;
}
