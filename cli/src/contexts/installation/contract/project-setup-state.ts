/** Whether the installation has already been run in a project, as a reader outside it asks. */
export interface ProjectSetupState {
  isSetUp(): Promise<boolean>;
}
