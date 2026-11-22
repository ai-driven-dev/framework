export interface FileWriter {
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  createDirectory(path: string): Promise<void>;
  deleteEmptyDirectories(path: string): Promise<void>;
  deleteDirectory(path: string): Promise<void>;
}

/** Replaces the file at `path` with `content` so a reader never sees it half written. */
export type AtomicWrite = (path: string, content: string) => Promise<void>;
