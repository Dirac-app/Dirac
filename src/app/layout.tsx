import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dirac — Cursor for Messages",
  description:
    "A unified inbox with AI built in. Triage, understand, and respond to Gmail, Outlook, and Discord — fast.",
  metadataBase: new URL("https://dirac.app"),
  openGraph: {
    title: "Dirac — Cursor for Messages",
    description: "A unified inbox with AI built in.",
    url: "https://dirac.app",
    siteName: "Dirac",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
