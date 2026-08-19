import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Padel Ladder",
  description: "Live boxes, player movement, statistics, and match history.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
