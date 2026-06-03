"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { TransferState, FileMetadata } from "@/types";
import {
  chunkFile,
  encodeMetadata,
  SENTINEL_MESSAGE,
  HIGH_WATER_MARK,
  waitForDrain,
} from "@/lib/fileChunker";
import {
  initAssembly,
  appendChunk,
  finalizeAndDownload,
  AssemblyContext,
  ReceivedFileInfo,
} from "@/lib/fileAssembler";
import { generateRoomId } from "@/lib/roomId";

/**
 * Compute signaling server URL at runtime.
 *
 * Priority:
 * 1. NEXT_PUBLIC_SIGNALING_URL env var (Render Blueprint auto-sets this)
 * 2. Local dev: derive from window.location.hostname so mobile on the LAN
 *    automatically uses the Mac's real IP (e.g. http://192.168.0.182:3001)
 * 3. Absolute fallback: localhost:3001
 */
function getSignalingUrl(): string {
  if (process.env.NEXT_PUBLIC_SIGNALING_URL) {
    return process.env.NEXT_PUBLIC_SIGNALING_URL;
  }
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    // In production on Render there is no port 3001 — the env var MUST be set
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[QuantumDrop] NEXT_PUBLIC_SIGNALING_URL is not set! " +
        "Ensure you deployed using the render.yaml Blueprint."
      );
    }
    return `${protocol}//${hostname}:3001`;
  }
  return "http://localhost:3001";
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

interface UseWebRTCReturn {
  state: TransferState;
  roomId: string | null;
  file: File | null;
  fileMetadata: FileMetadata | null;
  bytesTransferred: number;
  error: string | null;
  selectFile: (file: File) => void;
  createRoom: () => void;
  connectToRoom: (roomId: string) => void;
  reset: () => void;
}

/**
 * Core WebRTC hook managing the entire P2P lifecycle for both sender and receiver.
 */
export function useWebRTC(role: "sender" | "receiver" = "sender"): UseWebRTCReturn {
  const [state, setState] = useState<TransferState>("idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [bytesTransferred, setBytesTransferred] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const assemblyRef = useRef<AssemblyContext | null>(null);
  const fileInfoRef = useRef<ReceivedFileInfo | null>(null);
  const isSendingRef = useRef(false);
  const currentFileRef = useRef<File | null>(null);
  // Ref mirror of state — avoids stale closures inside channel callbacks
  const stateRef = useRef<TransferState>("idle");
  // Buffer ICE candidates until setRemoteDescription completes (critical on mobile)
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);

  // Keep stateRef in sync so channel callbacks don't get stale values
  const setStateSynced = useCallback((s: TransferState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  const cleanup = useCallback(() => {
    isSendingRef.current = false;
    if (channelRef.current) {
      channelRef.current.close();
      channelRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setStateSynced("idle");
    setRoomId(null);
    setFile(null);
    setFileMetadata(null);
    setBytesTransferred(0);
    setError(null);
    currentFileRef.current = null;
    assemblyRef.current = null;
    fileInfoRef.current = null;
    pendingCandidatesRef.current = [];
    remoteDescSetRef.current = false;
  }, [cleanup, setStateSynced]);

  // ─── Sender: begin transfer over the open data channel ───────────────────
  const startTransfer = useCallback(async (channel: RTCDataChannel, fileToSend: File) => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    setStateSynced("transferring");

    // Set backpressure threshold
    channel.bufferedAmountLowThreshold = 1 * 1024 * 1024; // 1MB

    try {
      // Send file metadata as JSON first
      channel.send(encodeMetadata(fileToSend));

      let transferred = 0;
      for await (const { buffer } of chunkFile(fileToSend)) {
        // Backpressure: wait if buffer is too full
        if (channel.bufferedAmount > HIGH_WATER_MARK) {
          await waitForDrain(channel);
        }

        // Check channel is still open
        if (channel.readyState !== "open") {
          throw new Error("Channel closed during transfer");
        }

        channel.send(buffer);
        transferred += buffer.byteLength;
        setBytesTransferred(transferred);
      }

      // Send completion sentinel
      channel.send(SENTINEL_MESSAGE);
      setStateSynced("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
      setStateSynced("error");
    } finally {
      isSendingRef.current = false;
    }
  }, []);

  // ─── Setup data channel event handlers ───────────────────────────────────
  const setupChannel = useCallback(
    (channel: RTCDataChannel, channelRole: "sender" | "receiver") => {
      channelRef.current = channel;
      channel.binaryType = "arraybuffer";

      channel.onopen = async () => {
        setStateSynced("channel-open");

        // Disconnect from signaling server — pure P2P from here
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }

        if (channelRole === "sender" && currentFileRef.current) {
          await startTransfer(channel, currentFileRef.current);
        } else if (channelRole === "receiver") {
          setStateSynced("receiving");
        }
      };

      channel.onmessage = async (event) => {
        if (channelRole === "receiver") {
          // First message is metadata JSON
          if (typeof event.data === "string") {
            try {
              const parsed = JSON.parse(event.data);

              if (parsed.type === "metadata") {
                fileInfoRef.current = {
                  name: parsed.name,
                  size: parsed.size,
                  mimeType: parsed.mimeType,
                };
                setFileMetadata({
                  name: parsed.name,
                  size: parsed.size,
                  type: parsed.mimeType,
                  lastModified: parsed.lastModified,
                });
                assemblyRef.current = await initAssembly(fileInfoRef.current!);
                setStateSynced("transferring");
              } else if (parsed.type === "complete") {
                // Transfer complete — trigger download
                if (assemblyRef.current && fileInfoRef.current) {
                  await finalizeAndDownload(assemblyRef.current, fileInfoRef.current);
                }
                setStateSynced("receive-complete");
              }
            } catch {
              // Not JSON — ignore
            }
          } else if (event.data instanceof ArrayBuffer) {
            // Binary chunk
            if (assemblyRef.current) {
              await appendChunk(assemblyRef.current, event.data);
              setBytesTransferred(assemblyRef.current.bytesReceived);
            }
          }
        }
      };

      channel.onerror = (event) => {
        console.error("Channel error:", event);
        setError("Data channel error. Connection may have been lost.");
        setStateSynced("error");
      };

      channel.onclose = () => {
        // Use stateRef to avoid stale closure — state would always be the
        // value at the time setupChannel was called without this ref.
        const s = stateRef.current;
        if (s !== "complete" && s !== "receive-complete" && s !== "idle") {
          setStateSynced("error");
          setError("Connection lost. The bridge was fractured.");
        }
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startTransfer]
  );

  // ─── Create RTCPeerConnection ─────────────────────────────────────────────
  const createPeer = useCallback(
    (socket: Socket, currentRoomId: string, peerRole: "sender" | "receiver") => {
      const peer = new RTCPeerConnection(RTC_CONFIG);
      peerRef.current = peer;

      // ICE candidate relay
      peer.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit("ice-candidate", {
            roomId: currentRoomId,
            candidate: event.candidate,
          });
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed") {
          setError("WebRTC connection failed. Connection fractured.");
          setStateSynced("error");
        }
        // Note: 'disconnected' is transient on mobile networks — don't error on it
      };

      // Receiver: listen for incoming data channel
      if (peerRole === "receiver") {
        peer.ondatachannel = (event) => {
          setupChannel(event.channel, "receiver");
        };
      }

      return peer;
    },
    [setupChannel]
  );

  // ─── Sender: Select file ──────────────────────────────────────────────────
  const selectFile = useCallback((selectedFile: File) => {
    currentFileRef.current = selectedFile;
    setFile(selectedFile);
    setState("file-selected");
    setError(null);
  }, []);

  // ─── Sender: Create room and wait for peer ────────────────────────────────
  const createRoom = useCallback(() => {
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    setState("room-created");

    const socket = io(getSignalingUrl(), { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-room", { roomId: newRoomId, role: "sender" });
    });

    socket.on("peer-joined", async () => {
      setState("peer-connecting");
      const peer = createPeer(socket, newRoomId, "sender");

      // Create data channel before offer
      const channel = peer.createDataChannel("file-transfer", {
        ordered: true,
      });
      setupChannel(channel, "sender");

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("offer", { roomId: newRoomId, offer });
    });

    socket.on("answer", async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(answer);
        remoteDescSetRef.current = true;

        // Flush any ICE candidates that arrived before the remote description
        for (const candidate of pendingCandidatesRef.current) {
          await peerRef.current.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current = [];
      }
    });

    socket.on("ice-candidate", async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (!candidate) return;
      if (peerRef.current && remoteDescSetRef.current) {
        await peerRef.current.addIceCandidate(candidate);
      } else {
        // Buffer until setRemoteDescription is called (common on mobile)
        pendingCandidatesRef.current.push(candidate);
      }
    });

    socket.on("room-full", () => {
      setError("Room is full. Only two peers allowed.");
      setState("error");
      socket.disconnect();
    });

    socket.on("connect_error", () => {
      setError("Cannot connect to signaling server. Is it running on port 3001?");
      setState("error");
    });
  }, [createPeer, setupChannel]);

  // ─── Receiver: Connect to existing room ──────────────────────────────────
  const connectToRoom = useCallback(
    (targetRoomId: string) => {
      setRoomId(targetRoomId);
      setState("peer-connecting");

      const socket = io(getSignalingUrl(), { transports: ["websocket"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("join-room", { roomId: targetRoomId, role: "receiver" });
      });

      socket.on("offer", async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
        const peer = createPeer(socket, targetRoomId, "receiver");
        await peer.setRemoteDescription(offer);
        remoteDescSetRef.current = true;

        // Flush any ICE candidates that arrived before the remote description
        for (const candidate of pendingCandidatesRef.current) {
          await peer.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current = [];

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("answer", { roomId: targetRoomId, answer });
      });

      socket.on("ice-candidate", async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        if (!candidate) return;
        if (peerRef.current && remoteDescSetRef.current) {
          await peerRef.current.addIceCandidate(candidate);
        } else {
          // Buffer until offer is processed (common on mobile)
          pendingCandidatesRef.current.push(candidate);
        }
      });

      socket.on("room-not-found", () => {
        setError("Room not found. The link may have expired.");
        setState("error");
      });

      socket.on("connect_error", () => {
        setError("Cannot connect to signaling server.");
        setState("error");
      });
    },
    [createPeer]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    state,
    roomId,
    file,
    fileMetadata,
    bytesTransferred,
    error,
    selectFile,
    createRoom,
    connectToRoom,
    reset,
  };
}
