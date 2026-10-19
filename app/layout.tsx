import type { Metadata } from "next";
import { Unbounded } from "next/font/google";
import "./globals.css";
import Cursor from "@/components/Cursor";

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stellar Client",
  description: "Stellar Client",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${unbounded.variable} antialiased`}
      >
        <Cursor />
        {children}
      </body>
    </html>
  );
}
