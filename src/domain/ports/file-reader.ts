import type { FileHash } from "../models/file.js";

export interface FileReader {
  readFile(path: string): Promise<string>;
  listDirectory(path: string): Promise<string[]>;
  fileExists(path: string): Promise<boolean>;
  readFileHash(path: string): Promise<FileHash>;
  listFilesRecursive(dirPath: string): Promise<string[]>;
}
