import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ locale }) => {
  // We keep the locale list small and explicit.
  // If you add more languages later, add them here and create a messages/<locale>.json file.
  const supported = ["en", "rw"] as const;
  const safeLocale = supported.includes(locale as any) ? locale : "rw";

  const messages =
    safeLocale === "en"
      ? (await import("../../messages/en.json")).default
      : (await import("../../messages/rw.json")).default;

  return {
    messages
  };
});
