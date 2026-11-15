import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.edenisystem.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/en/admin",
          "/rw/admin",
          "/en/dashboard",
          "/rw/dashboard",
          "/en/products",
          "/rw/products",
          "/en/sell",
          "/rw/sell",
          "/en/analytics",
          "/rw/analytics",
          "/en/reports",
          "/rw/reports",
          "/en/branches",
          "/rw/branches",
          "/en/team",
          "/rw/team",
          "/en/settings",
          "/rw/settings",
          "/en/ledger",
          "/rw/ledger",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
