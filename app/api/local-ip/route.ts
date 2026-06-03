import { NextResponse } from "next/server";

/**
 * Returns the machine's LAN IP address for local development.
 *
 * On Vercel (production) this returns null — the server is in a cloud
 * datacenter, not on the user's LAN. The QR code URL is already correct
 * in production because window.location.origin is the Vercel HTTPS domain.
 *
 * On local dev, returns the Mac's WiFi IP (e.g. 192.168.0.182) so the
 * QR code works when scanned by a phone on the same network.
 */
export async function GET() {
  // In production (Vercel) the concept of a "local LAN IP" doesn't apply.
  // The Next.js app itself is already on a public HTTPS domain.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ip: null });
  }

  try {
    const { networkInterfaces } = await import("os");
    const nets = networkInterfaces();
    const candidates: string[] = [];

    for (const name of Object.keys(nets)) {
      for (const net of nets[name] ?? []) {
        if (net.family === "IPv4" && !net.internal) {
          candidates.push(net.address);
        }
      }
    }

    const lanIp =
      candidates.find((ip) => ip.startsWith("192.168.")) ??
      candidates.find((ip) => ip.startsWith("10.")) ??
      candidates.find((ip) => ip.startsWith("172.")) ??
      candidates[0] ??
      null;

    return NextResponse.json({ ip: lanIp });
  } catch {
    return NextResponse.json({ ip: null });
  }
}
