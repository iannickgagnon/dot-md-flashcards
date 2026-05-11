/**
 * @fileoverview File System Access helpers for writing Markdown deck files.
 * DOM TypeScript libs omit writable-stream details on `FileSystemFileHandle`; we extend types here.
 */

export const MARKDOWN_PICKER_TYPES: Array<{ description: string; accept: Record<string, string[]> }> = [
  {
    description: "Markdown",
    accept: { "text/markdown": [".md", ".markdown"] },
  },
];

export type MarkdownFileWritable = {
  write(chunk: Blob): Promise<void>;
  close(): Promise<void>;
};

/** Chromium file handle with write APIs (DOM `lib` typings are incomplete). */
export type MarkdownFileHandle = FileSystemFileHandle & {
  queryPermission(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  createWritable(): Promise<MarkdownFileWritable>;
};

export type WindowWithFileSystemAccess = Window & {
  showOpenFilePicker?: (options: {
    types: Array<{ description: string; accept: Record<string, string[]> }>;
    multiple: boolean;
    startIn?: FileSystemHandle;
  }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
    startIn?: FileSystemHandle;
  }) => Promise<FileSystemFileHandle>;
};

/**
 * Overwrites a file handle with UTF-8 Markdown. Requests readwrite permission first because
 * browsers may not grant it until the user approves (or the handle was just created via save picker).
 */
export async function writeTextToFileHandle(handle: FileSystemFileHandle, text: string): Promise<void> {
  const fileHandle = handle as MarkdownFileHandle;
  const readWrite = { mode: "readwrite" as const };
  if ((await fileHandle.queryPermission(readWrite)) !== "granted") {
    if ((await fileHandle.requestPermission(readWrite)) !== "granted") {
      throw new DOMException("Write permission denied", "NotAllowedError");
    }
  }
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  } finally {
    await writable.close();
  }
}
