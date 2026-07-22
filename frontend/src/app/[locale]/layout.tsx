import IntlProviderClient from "@/components/IntlProviderClient";
import enMessages from "../../../messages/en.json";
import rwMessages from "../../../messages/rw.json";

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
