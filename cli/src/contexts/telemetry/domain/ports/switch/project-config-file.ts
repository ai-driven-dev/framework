/** A project's `.aidd/config.json`, which a team may track. Consent no longer lives in it; it
 * is read only to clear what the previous version wrote there. */
export interface ProjectConfigFile {
  read(root: string): Promise<string | null>;
  write(root: string, text: string): Promise<void>;
  remove(root: string): Promise<void>;
}
