/**
 * File assembly on the receiver side.
 * Strategy 1: OPFS (Origin Private File System) — for large files, no memory limit.
 * Strategy 2: Blob array fallback — for browsers without OPFS support.
 */

export interface AssemblyContext {
  strategy: "opfs" | "blob";
  chunks: ArrayBuffer[];
  opfsWritable?: FileSystemWritableFileStream;
  opfsFile?: FileSystemFileHandle;
  bytesReceived: number;
}

export interface ReceivedFileInfo {
  name: string;
  size: number;
  mimeType: string;
}

/**
 * Initialize the assembly context for a new incoming file.
 */
export async function initAssembly(
  fileInfo: ReceivedFileInfo
): Promise<AssemblyContext> {
  // Try OPFS first (Chrome, supported with COOP/COEP headers)
  if (
    "storage" in navigator &&
    typeof navigator.storage.getDirectory === "function"
  ) {
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(fileInfo.name, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      return {
        strategy: "opfs",
        chunks: [],
        opfsWritable: writable,
        opfsFile: fileHandle,
        bytesReceived: 0,
      };
    } catch {
      // Fall through to Blob strategy
    }
  }

  // Blob fallback
  return {
    strategy: "blob",
    chunks: [],
    bytesReceived: 0,
  };
}

/**
 * Append a received chunk to the assembly context.
 */
export async function appendChunk(
  ctx: AssemblyContext,
  chunk: ArrayBuffer
): Promise<void> {
  ctx.bytesReceived += chunk.byteLength;

  if (ctx.strategy === "opfs" && ctx.opfsWritable) {
    await ctx.opfsWritable.write(chunk);
  } else {
    ctx.chunks.push(chunk);
  }
}

/**
 * Finalize assembly and trigger browser download.
 */
export async function finalizeAndDownload(
  ctx: AssemblyContext,
  fileInfo: ReceivedFileInfo
): Promise<void> {
  let url: string;

  if (ctx.strategy === "opfs" && ctx.opfsWritable && ctx.opfsFile) {
    await ctx.opfsWritable.close();
    const file = await ctx.opfsFile.getFile();
    url = URL.createObjectURL(file);
  } else {
    const blob = new Blob(ctx.chunks, { type: fileInfo.mimeType || "application/octet-stream" });
    url = URL.createObjectURL(blob);
  }

  // Trigger download
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileInfo.name;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Cleanup after short delay
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
