/**
 * File chunking utilities for P2P transfer.
 * Uses File.slice() for on-the-fly chunking — never loads entire file into memory.
 */

export const CHUNK_SIZE = 16 * 1024; // 16KB per chunk
export const HIGH_WATER_MARK = 16 * 1024 * 1024; // 16MB backpressure ceiling
export const LOW_WATER_MARK = 1 * 1024 * 1024; // 1MB — resume below this

// Special JSON sentinel to signal transfer completion
export const SENTINEL_MESSAGE = JSON.stringify({ type: "complete" });

// Metadata message encoder
export function encodeMetadata(file: File): string {
  return JSON.stringify({
    type: "metadata",
    name: file.name,
    size: file.size,
    mimeType: file.type,
    lastModified: file.lastModified,
  });
}

/**
 * Async generator that yields ArrayBuffer chunks from a File.
 * Each chunk is CHUNK_SIZE bytes except possibly the last one.
 */
export async function* chunkFile(
  file: File
): AsyncGenerator<{ buffer: ArrayBuffer; offset: number; chunkIndex: number }> {
  let offset = 0;
  let chunkIndex = 0;

  while (offset < file.size) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await slice.arrayBuffer();
    yield { buffer, offset, chunkIndex };
    offset += CHUNK_SIZE;
    chunkIndex++;
  }
}

/**
 * Returns a promise that resolves when the bufferedamountlow event fires.
 * Used for backpressure: pause sending when buffer is full.
 */
export function waitForDrain(channel: RTCDataChannel): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      channel.removeEventListener("bufferedamountlow", handler);
      resolve();
    };
    channel.addEventListener("bufferedamountlow", handler);
  });
}
