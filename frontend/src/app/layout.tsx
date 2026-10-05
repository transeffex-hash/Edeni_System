import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Fraunces, Sora } from "next/font/google";

import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://edenisystem.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "EdeniSystem",
  title: {
    default: "EdeniSystem — Inventory & Sales Management for Rwanda Shops",
    template: "%s | EdeniSystem",
  },
  description:
    "Fast, reliable inventory and sales management for wholesalers and retailers across Rwanda. Track stock, record sales, manage customer and supplier ledgers, and see analytics in one place.",
  keywords: [
    "inventory management Rwanda",
    "sales management app",
    "stock tracking",
    "POS Rwanda",
    "business management software",
    "EdeniSystem",
  ],
  creator: "Transeffex Ltd",
  publisher: "Transeffex Ltd",
  icons: {
    icon: "/logo.png",
    apple: "/apple-icon.png",
  },
  alternates: {
    canonical: "/",
    languages: {
      en: "/en",
      rw: "/rw",
    },
  },
  openGraph: {
    type: "website",
    siteName: "EdeniSystem",
    title: "EdeniSystem — Inventory & Sales Management for Rwanda Shops",
    description:
      "Fast, reliable inventory and sales management for wholesalers and retailers across Rwanda.",
    url: SITE_URL,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "EdeniSystem — Inventory and sales management for Rwanda shops",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EdeniSystem — Inventory & Sales Management for Rwanda Shops",
    description:
      "Fast, reliable inventory and sales management for wholesalers and retailers across Rwanda.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "EdeniSystem",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description:
    "Inventory and sales management for wholesalers and retailers across Rwanda.",
  email: "transeffex@gmail.com",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Kibagabaga, KG 313 St, House 10",
    addressLocality: "Kigali",
    addressCountry: "RW",
  },
  parentOrganization: {
    "@type": "Organization",
    name: "Transeffex Ltd",
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "EdeniSystem",
  url: SITE_URL,
  inLanguage: ["en", "rw"],
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
    <html lang={locale} suppressHydrationWarning className={`${sora.variable} ${fraunces.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
