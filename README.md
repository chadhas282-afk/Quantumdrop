# ⚡ QuantumDrop

**Zero-cloud P2P file transfer.** Send any file, any size, directly browser-to-browser via WebRTC. No accounts. No cloud storage. Files never touch a server.

---

## Architecture

```
Browser A (Sender) ──── WebRTC DataChannel ────► Browser B (Receiver)
         │                                                │
         └──── WebSocket (SDP offer/answer only) ────────┘
                       Signaling Server
                    (Render — ephemeral)
```

The **Next.js app** and the **signaling server** both run on **Render**.
The **signaling server** runs on **Render** (free tier).  
File data travels exclusively through the WebRTC DataChannel — never through any server.

---

## Local Development

```bash
# Terminal 1 — Signaling server (port 3001)
npm run signaling

# Terminal 2 — Next.js frontend (port 3000)
npm run dev
```

To test from a phone on the same WiFi, open the **Network URL** shown in the terminal (e.g. `http://192.168.0.182:3000`), not `localhost`.

---

## Deployment (1-Click on Render)

Both the Next.js frontend and the Signaling Server are deployed together on Render using the included `render.yaml` Blueprint. This handles everything automatically, including linking the two services together via environment variables.

### Step 1 — Deploy to Render

1. Go to [render.com](https://render.com) and create an account if needed.
2. In the Render Dashboard, click **New +** -> **Blueprint**.
3. Connect your GitHub account and select this repository.
4. Render will read the `render.yaml` file and automatically configure **two** Web Services:
   * `quantumdrop-signaling` (The backend websocket server)
   * `quantumdrop-frontend` (The Next.js app)
5. Click **Apply**.
6. Render will automatically pass the signaling server's URL to the Next.js frontend during the build.
7. Once deployed, open the URL for `quantumdrop-frontend` (e.g. `https://quantumdrop-frontend.onrender.com`).

> **Free tier note:** Render's free tier spins down after 15 minutes of inactivity. When a new user tries to connect, it may take ~50 seconds for the apps to spin back up.

### Step 2 — Verify

1. Open your Render frontend URL
2. Drop a file → a QR code appears with your Render HTTPS URL
3. Scan the QR on your phone → receiver page opens
4. File transfers directly P2P and downloads automatically

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SIGNALING_URL` | **Auto-configured** | The Render Blueprint automatically passes this from the signaling service to the frontend. |

Copy `.env.example` to `.env.local` for local development.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 + Framer Motion |
| P2P Engine | Native `RTCDataChannel` (WebRTC) |
| Signaling | Socket.io (Node.js, deployed on Render) |
| Large file assembly | OPFS → Blob fallback |
| Wake Lock | Screen Wake Lock API |

---

## How It Works

1. **Sender** drops a file → app generates a cryptographic room ID
2. Sender connects to signaling server → receives a share link + QR code
3. **Receiver** opens the link → both peers exchange SDP offer/answer via WebSocket
4. WebRTC DataChannel opens → **signaling WebSocket disconnects** (true P2P isolation)
5. File is sliced into 16KB chunks and streamed with backpressure control
6. Receiver assembles chunks via OPFS (Chrome) or Blob array (Firefox/Safari)
7. Download triggers automatically when the last chunk arrives
