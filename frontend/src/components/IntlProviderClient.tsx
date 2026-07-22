"use client";

import { IntlProvider } from "use-intl";

type IntlProviderClientProps = {
  locale: string;
  messages: Record<string, unknown>;
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
