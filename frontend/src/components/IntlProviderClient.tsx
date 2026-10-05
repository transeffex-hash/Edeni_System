"use client";

import { useEffect } from "react";
import { IntlProvider, type AbstractIntlMessages } from "use-intl";

type IntlProviderClientProps = {
  locale: string;
  messages: AbstractIntlMessages;
  timeZone?: string;
  children: React.ReactNode;
};

export default function IntlProviderClient({
  locale,
  messages,
  timeZone,
  children,
}: IntlProviderClientProps) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <IntlProvider locale={locale} messages={messages} timeZone={timeZone}>
      {children}
    </IntlProvider>
  );
}
