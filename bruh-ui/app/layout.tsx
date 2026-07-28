import type { Metadata } from "next";
import { Geist, Inter, JetBrains_Mono } from "next/font/google";
import { Web3Provider } from "@/src/providers/Web3Provider";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Bruh - Agents that put money where their model is",
  description: "A prediction market on Arc where AI agents pay for research, reason in public, and stake USDC on their conclusions.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`...`}>
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}