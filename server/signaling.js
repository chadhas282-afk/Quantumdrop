/**
 * QuantumDrop Signaling Server
 * Ephemeral Socket.io server for WebRTC handshake brokering ONLY.
 * Zero file data ever passes through this server.
 * 
 * Run: node server/signaling.js
 */

const { createServer } = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

// Room registry: roomId -> { sender: socketId, receiver: socketId }
// Declared here so the /health endpoint closure can reference it
const rooms = new Map();

const httpServer = createServer((req, res) => {
  // Health check endpoint — required by Railway to confirm the service is alive
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", rooms: rooms.size }));
  }
});

const io = new Server(httpServer, {
  cors: {
    // Allow any origin — mobile devices on the LAN connect from
    // the machine's network IP (e.g. http://192.168.x.x:3000), not localhost
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});


io.on("connection", (socket) => {
  console.log(`[${new Date().toISOString()}] Peer connected: ${socket.id}`);

  socket.on("join-room", ({ roomId, role }) => {
    if (!roomId || !role) return;

    const room = rooms.get(roomId) || { sender: null, receiver: null };

    if (role === "sender") {
      if (room.sender) {
        socket.emit("room-full");
        return;
      }
      room.sender = socket.id;
      rooms.set(roomId, room);
      socket.join(roomId);
      console.log(`[${roomId}] Sender joined: ${socket.id}`);
    } else if (role === "receiver") {
      if (!room.sender) {
        socket.emit("room-not-found");
        return;
      }
      if (room.receiver) {
        socket.emit("room-full");
        return;
      }
      room.receiver = socket.id;
      rooms.set(roomId, room);
      socket.join(roomId);
      console.log(`[${roomId}] Receiver joined: ${socket.id}`);

      // Notify sender that receiver has joined
      io.to(room.sender).emit("peer-joined");
    }
  });

  // Relay WebRTC offer (sender -> receiver)
  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", { offer });
    console.log(`[${roomId}] Offer relayed`);
  });

  // Relay WebRTC answer (receiver -> sender)
  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", { answer });
    console.log(`[${roomId}] Answer relayed`);
  });

  // Relay ICE candidates
  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", { candidate });
  });

  // Cleanup on disconnect
  socket.on("disconnect", () => {
    console.log(`[${new Date().toISOString()}] Peer disconnected: ${socket.id}`);
    
    // Remove from any rooms
    for (const [roomId, room] of rooms.entries()) {
      if (room.sender === socket.id || room.receiver === socket.id) {
        // Notify the other peer
        socket.to(roomId).emit("peer-disconnected");
        rooms.delete(roomId);
        console.log(`[${roomId}] Room destroyed`);
        break;
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   QuantumDrop Signaling Server           ║
║   Listening on http://localhost:${PORT}     ║
║   Zero file data passes through here.   ║
╚══════════════════════════════════════════╝
  `);
});
