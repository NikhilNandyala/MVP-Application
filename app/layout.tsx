import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MDX Blog Builder",
  description: "Convert raw text to structured MDX with auto-tagging for Azure content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
