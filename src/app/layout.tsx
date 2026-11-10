import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({ variable: "--font-sans-face", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-display-face", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "LinkPass",
  description: "Let your children shop independently, on your terms.",
};

export const viewport: Viewport = { themeColor: "#f5f3ee", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable} font-sans antialiased`}>
        <div className="mx-auto min-h-dvh max-w-md px-4 pb-16">{children}</div>
      </body>
    </html>
  );
}
