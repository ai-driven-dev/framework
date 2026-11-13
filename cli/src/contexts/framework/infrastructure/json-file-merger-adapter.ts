import type { FileHash } from "../../../shared/domain/file.js";
import { type MergeStrategy, mergeIntoJsonFile } from "../../../shared/domain/merge.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { FileMerger } from "../domain/ports/file-merger.js";

/**
 * The files the install and restore flows touch, plus the one write only they make: a merge.
 * It hands every read and write to the file port it is given and adds the merge on top, so a
 * flow holds one object for both without the context reaching `shared/infrastructure`.
 */
export class JsonFileMergerAdapter implements FileReader, FileWriter, FileMerger {
  constructor(private readonly files: FileReader & FileWriter) {}

  readFile(path: string): Promise<string> {
    return this.files.readFile(path);
  }
  listDirectory(path: string): Promise<string[]> {
    return this.files.listDirectory(path);
  }
  fileExists(path: string): Promise<boolean> {
    return this.files.fileExists(path);
  }
  readFileHash(path: string): Promise<FileHash> {
    return this.files.readFileHash(path);
  }
  listFilesRecursive(dirPath: string): Promise<string[]> {
    return this.files.listFilesRecursive(dirPath);
  }
  isExecutable(path: string): Promise<boolean> {
    return this.files.isExecutable(path);
  }
  realpath(path: string): Promise<string> {
    return this.files.realpath(path);
  }
  writeFile(path: string, content: string): Promise<void> {
    return this.files.writeFile(path, content);
  }
  deleteFile(path: string): Promise<void> {
    return this.files.deleteFile(path);
  }
  createDirectory(path: string): Promise<void> {
    return this.files.createDirectory(path);
  }
  deleteEmptyDirectories(path: string): Promise<void> {
    return this.files.deleteEmptyDirectories(path);
  }
  deleteDirectory(path: string): Promise<void> {
    return this.files.deleteDirectory(path);
  }

  mergeJsonFile(path: string, content: string, strategy: MergeStrategy): Promise<void> {
    return mergeIntoJsonFile(this.files, path, content, strategy);
  }
}
