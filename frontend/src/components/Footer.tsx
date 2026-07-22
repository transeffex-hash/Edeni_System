"use client";

import { useLocale, useTranslations } from "use-intl";
import Link from "next/link";

export default function Footer() {
  const t = useTranslations("landing.footer");
  const locale = useLocale();

  const socialLinks = [
    {
      name: "linkedin",
      label: t("social.linkedin"),
      href: "#",
      iconLabel: "in",
    },
    {
      name: "instagram",
      label: t("social.instagram"),
      href: "#",
      iconLabel: "ig",
    },
    {
      name: "twitter",
      label: t("social.twitter"),
      href: "#",
      iconLabel: "x",
    },
    {
      name: "tiktok",
      label: t("social.tiktok"),
      href: "#",
      iconLabel: "tt",
    },
  ];

  return (
    <footer className="bg-[#0b1f1a] text-gray-100 py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main footer content */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Company info */}
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#f6c354] font-semibold mb-4">
              {t("company")}
            </p>
            <h3 className="font-display text-2xl text-white mb-2">
              {t("tagline")}
            </h3>
            <p className="text-gray-300">
              <a
                href={`mailto:${t("email")}`}
                className="hover:text-white transition-colors"
              >
                {t("email")}
              </a>
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">
              {t("contact")}
            </h4>
            <div className="space-y-2">
              <Link href={`/${locale}/login`} className="text-gray-300 hover:text-white transition-colors block">
                Sign In
              </Link>
              <Link href={`/${locale}/register`} className="text-gray-300 hover:text-white transition-colors block">
                Get Started
              </Link>
              <a
                href={`mailto:${t("email")}`}
                className="text-gray-300 hover:text-white transition-colors block"
              >
                Email Us
              </a>
            </div>
          </div>

          {/* Social links */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Follow Us</h4>
            <div className="flex flex-wrap gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-full border border-white/20 text-sm font-semibold text-white/80 hover:text-white hover:border-white/60 transition-colors"
                  title={social.label}
                >
                  {social.iconLabel}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 pt-8">
          {/* Copyright */}
          <div className="text-center text-gray-400 text-sm">
            <p>{t("copyright")}</p>
            <p className="mt-2">Developed by Transeffex Ltd • transeffex@gmail.com</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
