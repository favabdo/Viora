import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

export const metadata: Metadata = {
  title: "Viora",
  description: "Your tasks and links for every project, in one place",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#2E2AE6",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Poppins:wght@700;800&display=swap"
          rel="stylesheet"
        />
        {/* بنطبّق وضع الليل ولغة الواجهة قبل أول رسم للصفحة عشان نتجنب "وميض" الوضع الافتراضي
            (الإنجليزي/الفاتح) لو المستخدم كان مخزّن عربي أو وضع داكن من زيارة سابقة */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{
              if(localStorage.getItem('viora-theme')!=='light')document.documentElement.classList.add('dark');
              var l=localStorage.getItem('viora-lang');
              if(l==='ar'){document.documentElement.lang='ar';document.documentElement.dir='rtl';}
            }catch(e){}`,
          }}
        />
      </head>
      <body
        className="font-sans bg-paper text-ink antialiased"
        style={{ ["--font-inter" as any]: "Inter" }}
      >
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
