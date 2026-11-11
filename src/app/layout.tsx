import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PreviewBanner } from "@/components/preview-banner";

const sans = Inter({ variable: "--font-sans-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LinkPass",
  description: "Safe spending for every child. Their freedom. Your rules.",
};

export const viewport: Viewport = { themeColor: "#f4f6fa", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} min-h-dvh font-sans antialiased`}>
        <PreviewBanner />
        {children}
      </body>
    </html>
  );
}
