"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "use-intl";
import LocaleSwitcher from "@/components/LocaleSwitcher";

export default function LandingNav() {
  const t = useTranslations();
  const locale = useLocale();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "#features", label: t("landing.nav.features") },
    { href: "#pricing", label: t("landing.nav.pricing") },
    { href: "#contact", label: t("landing.nav.contact") },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link href={`/${locale}`} className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center overflow-hidden">
              <Image src="/edeni system logo.png" alt="EdeniSystem" width={56} height={56} className="object-contain" />
            </div>
            <div className="font-display font-semibold text-xl text-gray-900">{t("app.name")}</div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8 font-medium text-gray-600">
            {navLinks.map((link) => (
              <a key={link.href} className="hover:text-gray-900 transition-colors" href={link.href}>
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <LocaleSwitcher />
            <Link href={`/${locale}/login`} className="font-medium text-[#0a7e6b] hover:text-[#096657] transition-colors">
              {t("auth.login")}
            </Link>
            <Link
              href={`/${locale}/register`}
              className="px-6 py-2.5 bg-[#0a7e6b] text-white font-medium rounded-full shadow-sm hover:bg-[#096657] transition-all"
            >
              {t("auth.registerCta")}
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-4 md:hidden">
            <LocaleSwitcher />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-600 hover:text-gray-900 focus:outline-none p-2 rounded-md hover:bg-gray-100 transition-colors"
              aria-label="Toggle mobile menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 shadow-md animate-in slide-in-from-top-2">
          <div className="px-4 pt-2 pb-6 space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block px-3 py-3 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="border-t border-gray-100 pt-4 mt-4 space-y-3">
              <Link
                href={`/${locale}/login`}
                className="block w-full text-center px-4 py-3 text-base font-medium text-[#0a7e6b] hover:text-[#096657] hover:bg-gray-50 rounded-md transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t("auth.login")}
              </Link>
              <Link
                href={`/${locale}/register`}
                className="block w-full text-center px-4 py-3 text-base font-medium text-white bg-[#0a7e6b] hover:bg-[#096657] rounded-md transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t("auth.registerCta")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
