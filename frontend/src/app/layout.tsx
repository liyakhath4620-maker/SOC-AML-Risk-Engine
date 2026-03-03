import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOC-AML Risk Engine | Unified Threat Intelligence",
  description: "Real-time Unified SOC-AML Risk Engine — breach-to-financial linkage analysis, threat narratives, and pre-emptive account freezing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-[#f8f9fb] text-gray-900">
        {children}
      </body>
    </html>
  );
}
