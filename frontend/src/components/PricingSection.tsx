"use client";

import { useLocale, useTranslations } from "use-intl";
import Link from "next/link";

export default function PricingSection() {
  const t = useTranslations("landing");
  const locale = useLocale();

  return (
    <section id="pricing" className="py-16 md:py-24">
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

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Starter */}
          <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-[0_25px_70px_rgba(15,23,42,0.12)] backdrop-blur">
            <p className="text-sm uppercase tracking-[0.3em] text-[#0a7e6b] font-semibold mb-2">Starter</p>
            <div className="font-display text-4xl md:text-5xl text-gray-900 mt-3">
              RWF 20,000
            </div>
            <p className="text-lg text-gray-600 mt-2">per month</p>
            <ul className="mt-6 space-y-2 text-gray-700">
              <li className="flex items-center gap-2"><span>•</span> Up to 5 users</li>
            </ul>
            <Link href={`/${locale}/register`} className="mt-8 block">
              <button className="w-full rounded-full bg-[#0a7e6b] hover:bg-[#096657] text-white font-semibold py-4 px-8 text-lg transition-colors shadow-lg">
                Get started
              </button>
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-[0_25px_70px_rgba(15,23,42,0.12)] backdrop-blur">
            <p className="text-sm uppercase tracking-[0.3em] text-[#0a7e6b] font-semibold mb-2">Pro</p>
            <div className="font-display text-4xl md:text-5xl text-gray-900 mt-3">
              RWF 40,000
            </div>
            <p className="text-lg text-gray-600 mt-2">per month</p>
            <ul className="mt-6 space-y-2 text-gray-700">
              <li className="flex items-center gap-2"><span>•</span> Up to 10 users</li>
            </ul>
            <Link href={`/${locale}/register`} className="mt-8 block">
              <button className="w-full rounded-full bg-[#0a7e6b] hover:bg-[#096657] text-white font-semibold py-4 px-8 text-lg transition-colors shadow-lg">
                Get started
              </button>
            </Link>
          </div>

          {/* Full */}
          <div className="rounded-3xl border border-[#0a7e6b] bg-[#0a7e6b] p-8 shadow-[0_25px_70px_rgba(15,23,42,0.12)] text-white">
            <p className="text-sm uppercase tracking-[0.3em] font-semibold mb-2">Full</p>
            <div className="font-display text-4xl md:text-5xl mt-3">
              RWF 60,000
            </div>
            <p className="text-lg text-white/85 mt-2">per month</p>
            <ul className="mt-6 space-y-2 text-white/90">
              <li className="flex items-center gap-2"><span>•</span> All users & branches</li>
            </ul>
            <Link href={`/${locale}/register`} className="mt-8 block">
              <button className="w-full rounded-full bg-white hover:bg-white/90 text-[#0a7e6b] font-semibold py-4 px-8 text-lg transition-colors shadow-lg">
                Get started
              </button>
            </Link>
          </div>
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

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://transeffex.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-sm font-medium transition"
            >
              <span className="w-2 h-2 rounded-full bg-white" />
              Website
            </a>
            <a
              href="https://www.instagram.com/transeffex/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-sm font-medium transition"
            >
              <span className="w-2 h-2 rounded-full bg-white" />
              Instagram
            </a>
            <a
              href="https://x.com/transeffex"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-sm font-medium transition"
            >
              <span className="w-2 h-2 rounded-full bg-white" />
              X
            </a>
            <a
              href="https://www.tiktok.com/@transeffexsolution"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-sm font-medium transition"
            >
              <span className="w-2 h-2 rounded-full bg-white" />
              TikTok
            </a>
            <a
              href="https://wa.me/250781290496"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-sm font-medium transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.86.5 3.61 1.38 5.12L2 22l4.95-1.37C8.51 21.3 10.21 21.8 12 21.8c5.52 0 10-4.48 10-10S17.52 2 12 2zm4.95 14.2c-.19.54-1.08 1.01-1.49 1.06-.42.05-.86.19-2.88-.6-2.42-1-3.97-3.57-4.09-3.73-.12-.16-.98-1.3-.98-2.48s.61-1.76.84-2c.23-.25.49-.28.65-.28.16 0 .32 0 .46.01.14.01.33-.05.52.4.19.45.66 1.57.72 1.69.06.12.01.27-.02.37-.04.1-.08.22-.19.34-.1.12-.22.25-.32.34-.1.09-.21.19-.09.41.12.22.55.9 1.17 1.46.8.72 1.47.95 1.82 1.05.26.08.48-.03.55-.14.08-.1.31-.37.39-.5.08-.13.16-.11.27-.06.1.05 1.62.76 1.9.9.28.14.47.21.54.33.06.12.04.28-.02.4z"/>
              </svg>
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
