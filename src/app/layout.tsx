import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f0eb" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1e" },
  ],
};

export const metadata: Metadata = {
  title: "Dirac — Cursor for Messages",
  description:
    "A unified inbox with AI built in. Triage, understand, and respond to Gmail, Outlook, and Discord — fast.",
  metadataBase: new URL("https://dirac.app"),
  manifest: "/manifest.json",
  openGraph: {
    title: "Dirac — Cursor for Messages",
    description: "A unified inbox with AI built in.",
    url: "https://dirac.app",
    siteName: "Dirac",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dirac",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>{children}</body>
    </html>
  );
}
