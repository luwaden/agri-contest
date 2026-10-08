import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AssistantWidget } from "@/components/assistant/AssistantWidget";
import { PROGRAMME } from "@/config/programme";

export const metadata: Metadata = {
  title: { default: PROGRAMME.name, template: `%s · ${PROGRAMME.shortName}` },
  description: PROGRAMME.tagline,
  robots: { index: true, follow: true },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  openGraph: { type: "website", siteName: PROGRAMME.name, title: PROGRAMME.name, description: PROGRAMME.tagline, locale: "en_NG" },
  twitter: { card: "summary", title: PROGRAMME.name, description: PROGRAMME.tagline },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#005937" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:font-semibold">Skip to main content</a>
        {children}
        <AssistantWidget />
      </body>
    </html>
  );
}
