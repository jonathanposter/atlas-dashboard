import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas Mission Control",
  description: "Algorithmic Forex Pipeline v2.0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-atlas-bg text-atlas-text antialiased">
        {children}
      </body>
    </html>
  );
}
