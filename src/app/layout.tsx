import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DMM Draft Order",
  description: "Kick-authenticated draft order builder",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
