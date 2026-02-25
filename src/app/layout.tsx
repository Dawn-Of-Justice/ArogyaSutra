import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArogyaSutra — Your Health, Your Sovereignty",
  description:
    "AI-powered Personal Health Record with Zero-Knowledge encryption. Digitize, search, and protect your medical history.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ArogyaSutra",
  },
  keywords: [
    "health record",
    "PHR",
    "medical",
    "AI",
    "encryption",
    "India",
    "FHIR",
  ],
};

export const viewport: Viewport = {
  themeColor: "#10B981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
