"use client";

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
  return (
    <IntlProvider locale={locale} messages={messages} timeZone={timeZone}>
      {children}
    </IntlProvider>
  );
}
