import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const sans = Inter({ variable: "--font-sans-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LinkPass",
  description: "Let your children shop independently, on your terms.",
};

export const viewport: Viewport = { themeColor: "#f5f5f7", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} font-sans antialiased`}>
        <div className="mx-auto min-h-dvh max-w-md px-4 pb-16">{children}</div>
      </body>
    </html>
  );
}
