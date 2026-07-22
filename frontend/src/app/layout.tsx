import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Fraunces, Sora } from "next/font/google";

import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

import "./globals.css";

export const metadata: Metadata = {
  title: "EdeniSystem",
  description: "Inventory and sales for Rwanda shops"
};

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["300", "400", "500", "600", "700"]
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "600", "700"]
});

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const supported = ["en", "rw"] as const;
  const cookieLocale = cookies().get("NEXT_LOCALE")?.value;
  const locale = supported.includes(cookieLocale as any) ? cookieLocale : "rw";

  return (
    <html lang={locale} className={`${sora.variable} ${fraunces.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
