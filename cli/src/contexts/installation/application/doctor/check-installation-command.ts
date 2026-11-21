/** What every doctor check over the installation is asked: where the project is and which tools
 * it is narrowed to (`null` for all of them). */
export interface CheckInstallationCommand {
  projectRoot: string;
  allowedIds: Set<string> | null;
}
