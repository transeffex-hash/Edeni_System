"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "use-intl";

export default function LandingNav() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <nav className="sticky top-4 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-panel rounded-full px-6 py-3 flex items-center justify-between gap-4">
          <Link href={`/${locale}`} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm overflow-hidden">
              <Image src="/edeni system logo.png" alt="EdeniSystem" width={36} height={36} />
            </div>
            <div className="font-semibold text-gray-900">{t("app.name")}</div>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm text-gray-700">
            <a className="hover:text-gray-900" href="#features">
              {t("landing.nav.features")}
            </a>
            <a className="hover:text-gray-900" href="#pricing">
              {t("landing.nav.pricing")}
            </a>
            <a className="hover:text-gray-900" href="#contact">
              {t("landing.nav.contact")}
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/${locale}/login`} className="px-4 py-2 text-[#0a7e6b] font-semibold hover:text-[#096657]">
              {t("auth.login")}
            </Link>
            <Link
              href={`/${locale}/register`}
              className="px-5 py-2 bg-[#0a7e6b] text-white font-semibold rounded-full hover:bg-[#096657]"
            >
              {t("auth.registerCta")}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
