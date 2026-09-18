import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { CallBar } from "@/components/site/CallBar";
import { RevealObserver } from "@/components/site/RevealObserver";

export const metadata: Metadata = {
  title: "DigiLabs ITAD — Certified E-Waste Recycling & Data Destruction",
  description:
    "NIST 800-88 certified data destruction and e-waste recycling for homes and businesses across Broward, Miami-Dade, and Palm Beach counties.",
  icons: {
    icon: [
      { url: "/assets/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/favicon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/assets/favicon-180.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <CallBar />
        <RevealObserver />
      </body>
    </html>
  );
}
