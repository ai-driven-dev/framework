export class StatusReport {
  readonly modified: readonly string[];
  readonly deleted: readonly string[];
  readonly untracked: readonly string[];

  constructor(params: {
    modified: string[];
    deleted: string[];
    untracked: string[];
  }) {
    this.modified = Object.freeze([...params.modified]);
    this.deleted = Object.freeze([...params.deleted]);
    this.untracked = Object.freeze([...params.untracked]);
  }

  isEmpty(): boolean {
    return this.modified.length === 0 && this.deleted.length === 0 && this.untracked.length === 0;
  }
}
