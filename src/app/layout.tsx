import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DMM Draft Order",
  description: "Pick your own draft order to win 500M OSRS GP from Odablock",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="site-footer">
          <a
            href="https://github.com/LogicalSoIutions/dmm-draft-picks"
            target="_blank"
            rel="noopener noreferrer"
          >
            View source on GitHub
          </a>
        </footer>
      </body>
    </html>
  );
}
