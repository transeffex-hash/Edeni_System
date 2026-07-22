"use client";

import { useLocale, useTranslations } from "use-intl";
import Link from "next/link";

export default function PricingSection() {
  const t = useTranslations("landing");
  const locale = useLocale();

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-gray-900 mb-4">
            {t("pricingTitle")}
          </h2>
          <p className="text-lg md:text-xl text-gray-700">
            {t("pricingSubtitle")}
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-stretch">
          {/* Pricing card */}
          <div className="rounded-3xl border border-white/60 bg-white/80 p-8 md:p-12 shadow-[0_25px_70px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[#0a7e6b] font-semibold">
                  {t("pricingTitle")}
                </p>
                <div className="font-display text-5xl md:text-6xl text-gray-900 mt-3">
                  {t("price")}
                </div>
                <p className="text-lg text-gray-600 mt-2">
                  {t("billingPeriod")}
                </p>
              </div>
              <div className="rounded-2xl bg-[#0a7e6b] text-white px-5 py-4 shadow-lg">
                <p className="text-sm font-semibold">{t("discount")}</p>
              </div>
            </div>

            <Link href={`/${locale}/register`}>
              <button className="w-full rounded-full bg-[#0a7e6b] hover:bg-[#096657] text-white font-semibold py-4 px-8 text-lg transition-colors shadow-lg mb-6">
                {t("pricingCta")}
              </button>
            </Link>

            <p className="text-center text-gray-600 text-sm">
              {t("contactEmail")}
            </p>
          </div>

          {/* Contact section */}
          <div
            id="contact"
            className="rounded-3xl bg-gradient-to-br from-[#0b1f1a] via-[#0a7e6b] to-[#f06a2b] p-8 text-white shadow-[0_20px_60px_rgba(15,23,42,0.2)]"
          >
            <h3 className="font-display text-2xl md:text-3xl mb-3">
              {t("contactTitle")}
            </h3>
            <p className="text-white/85 mb-6">
              {t("contactSubtitle")}
            </p>
            <a
              className="inline-flex items-center justify-center px-5 py-3 rounded-full bg-white text-[#0b1f1a] font-semibold hover:bg-white/90"
              href="mailto:transeffex@gmail.com"
            >
              transeffex@gmail.com
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
