import type { Metadata } from "next";
import "./globals.css";
import BackgroundBlobs from "@/components/BackgroundBlobs";

export const metadata: Metadata = {
  title: "QuantumDrop — Zero-Cloud P2P File Transfer",
  description:
    "Send files of any size directly browser-to-browser. No cloud storage. No accounts. Pure peer-to-peer powered by WebRTC.",
  keywords: ["file transfer", "P2P", "WebRTC", "no cloud", "privacy", "peer to peer"],
  openGraph: {
    title: "QuantumDrop — Zero-Cloud P2P File Transfer",
    description: "Send files of any size directly browser-to-browser. No servers. No accounts.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <head>
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#050510" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased" style={{ background: "#050510" }}>
        {/* Animated background blobs */}
        <BackgroundBlobs />

        {/* Main content */}
        <div className="relative z-10 min-h-dvh">
          {children}
        </div>
      </body>
    </html>
  );
}
