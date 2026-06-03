import type { NextConfig } from "next";

// ─── Local dev: allow HMR from mobile browsers on the LAN ────────────────
// On Vercel this runs on their build servers — getLanIps() would return
// Vercel's internal IPs which are useless, so we guard it to dev only.
function getLanIpsForDev(): string[] {
  if (process.env.NODE_ENV === "production") return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { networkInterfaces } = require("os") as typeof import("os");
    const nets = networkInterfaces();
    const ips: string[] = [];
    for (const name of Object.keys(nets)) {
      const ifaces = nets[name];
      if (!ifaces) continue;
      for (const iface of ifaces) {
        if (iface.family === "IPv4" && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    return ips;
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  // Allow HMR WebSocket from mobile browsers on the local LAN (dev only)
  allowedDevOrigins: getLanIpsForDev(),
};

export default nextConfig;
