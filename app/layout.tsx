import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Abdul",
  description: "Personal photo gallery",
  metadataBase: new URL("https://abdul.no"),
  icons: {
    icon: "/assets/logo.ico",
    shortcut: "/assets/logo.ico",
    apple: "/assets/logo.png",
  },
  openGraph: {
    title: "Abdul",
    description: "Personal photo gallery",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
