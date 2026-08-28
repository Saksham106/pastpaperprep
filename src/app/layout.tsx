import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createThemeInitScript } from "@/components/ThemeInitScript";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://pastpaperprep.com"),
  title: { default: "PastPaperPrep | Practise smarter", template: "%s | PastPaperPrep" },
  description: "Topic-by-topic past paper practice for IGCSE and IB Mathematics, with worked answers and focused filtering.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const authenticated = typeof claimsData?.claims?.sub === "string";

  return (
    <html lang="en" className={`${geist.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="pastpaperprep-theme" strategy="beforeInteractive">{createThemeInitScript(authenticated)}</Script>
        <SiteHeader authenticated={authenticated} />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
