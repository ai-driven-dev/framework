/** One scope a machine-wide run could not finish, reported so the rest of the run still goes on. */
export interface GlobalExecutionError {
  scope: string;
  message: string;
}
