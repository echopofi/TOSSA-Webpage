import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alumni Connect — Your School's Alumni Network",
  description:
    "Stay connected with your graduating set, pay dues, and be part of your school's alumni community.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
