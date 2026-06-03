# ⚡ QuantumDrop

**Zero-cloud P2P file transfer.** Send any file, any size, directly browser-to-browser via WebRTC. No accounts. No cloud storage. Files never touch a server.

---

## Architecture

```
Browser A (Sender) ──── WebRTC DataChannel ────► Browser B (Receiver)
         │                                                │
         └──── WebSocket (SDP offer/answer only) ────────┘
                       Signaling Server
                    (Railway — ephemeral)
```

The **Next.js app** runs on **Vercel**.  
The **signaling server** runs on **Railway** (free tier).  
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

## Deployment

### Step 1 — Deploy the Signaling Server to Railway

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
2. Select this repository
3. Railway will auto-detect the `Procfile` and run `node server/signaling.js`
4. Once deployed, copy the public URL (e.g. `https://quantumdrop-signaling.railway.app`)

> **Free tier note:** Railway's free tier (Hobby) gives 500 hours/month — enough for a personal app. The signaling server uses minimal resources since it only handles WebRTC handshakes (~1KB per connection).

### Step 2 — Deploy the Next.js App to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project → Import Git Repository**
2. Select this repository
3. In **Environment Variables**, add:
   ```
   NEXT_PUBLIC_SIGNALING_URL = https://your-app.railway.app
   ```
4. Click **Deploy**

That's it. Vercel auto-detects Next.js and builds it correctly.

### Step 3 — Verify

1. Open your Vercel URL
2. Drop a file → a QR code appears with your Vercel HTTPS URL
3. Scan the QR on your phone → receiver page opens
4. File transfers directly P2P and downloads automatically

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SIGNALING_URL` | **Yes (production)** | Full URL of the Railway signaling server, e.g. `https://quantumdrop-signaling.railway.app` |

Copy `.env.example` to `.env.local` for local development.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 + Framer Motion |
| P2P Engine | Native `RTCDataChannel` (WebRTC) |
| Signaling | Socket.io (Node.js, deployed on Railway) |
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
