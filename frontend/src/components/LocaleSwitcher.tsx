"use client";

import { useLocale } from "use-intl";
import { usePathname, useRouter } from "next/navigation";

export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale() {
    const next = locale === "rw" ? "en" : "rw";
    // Save preference in cookie so the middleware remembers it
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    // Swap the locale prefix in the current URL path
    const newPath = pathname.replace(`/${locale}`, `/${next}`);
    router.push(newPath);
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      title={locale === "rw" ? "Switch to English" : "Hindura Ikinyarwanda"}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-all"
    >
      {locale === "rw" ? (
        <>
          <span className="text-base">🇷🇼</span>
          <span>RW</span>
        </>
      ) : (
        <>
          <span className="text-base">🇬🇧</span>
          <span>EN</span>
        </>
      )}
    </button>
  );
}
