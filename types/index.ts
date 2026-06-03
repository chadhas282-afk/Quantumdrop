// Shared TypeScript types for QuantumDrop

export type TransferState =
  | "idle"
  | "file-selected"
  | "room-created"
  | "peer-connecting"
  | "channel-open"
  | "transferring"
  | "complete"
  | "error"
  | "receiving"
  | "receive-complete";

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface TransferStats {
  bytesTransferred: number;
  totalBytes: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
  percentage: number; // 0-100
}

export interface SignalingMessage {
  type: "offer" | "answer" | "ice-candidate" | "peer-joined" | "room-full" | "channel-open" | "file-metadata";
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit | FileMetadata | null;
  roomId?: string;
}

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

export type PeerRole = "sender" | "receiver";

export interface DataChannelMessage {
  type: "metadata" | "chunk" | "complete";
  payload?: FileMetadata | ArrayBuffer | null;
}
