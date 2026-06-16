import type { Metadata, Viewport } from "next";
import { Inter, Merriweather_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const merriweatherSans = Merriweather_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
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
  title: "Dirac, Your Inbox",
  description:
    "The first inbox built for founders.",
  metadataBase: new URL("https://app.dirac.app"),
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/icon-192.png",
  },
  openGraph: {
    title: "Dirac, Your Inbox",
    description: "The first inbox built for founders.",
    url: "https://app.dirac.app",
    siteName: "Dirac, Your Inbox",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dirac, Your Inbox",
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
      <body className={`${inter.variable} ${merriweatherSans.variable} font-sans antialiased`} suppressHydrationWarning>{children}</body>
    </html>
  );
}
