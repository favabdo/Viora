import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Viora",
  description: "مهامك وروابطك لكل مشروع في مكان واحد",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Poppins:wght@700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="font-sans bg-paper text-ink antialiased"
        style={{ ["--font-inter" as any]: "Inter" }}
      >
        {children}
      </body>
    </html>
  );
}
