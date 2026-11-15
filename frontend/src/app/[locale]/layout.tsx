import type { Metadata } from "next";

import IntlProviderClient from "@/components/IntlProviderClient";
import enMessages from "../../../messages/en.json";
import rwMessages from "../../../messages/rw.json";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = params.locale === "en" ? "en" : "rw";
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: "/en",
        rw: "/rw",
        "x-default": "/en",
      },
    },
    openGraph: {
      locale: locale === "en" ? "en_US" : "rw_RW",
      url: `/${locale}`,
    },
  };
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const locale = params.locale === "en" ? "en" : "rw";
  const messages = locale === "en" ? enMessages : rwMessages;

  return (
    <IntlProviderClient locale={locale} messages={messages} timeZone="Africa/Kigali">
      {children}
    </IntlProviderClient>
  );
}
