"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "use-intl";

interface HeroSlide {
  image: string;
  alt: string;
  key: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    image: "/edeni system logo.png",
    alt: "EdeniSystem Logo",
    key: "logo",
  },
  {
    image: "/a wholesaler man selling stock edeni system.jpg",
    alt: "Wholesaler managing stock",
    key: "wholesaler",
  },
  {
    image: "/woman selling clothes edeni system.avif",
    alt: "Woman selling clothes",
    key: "clothes",
  },
  {
    image: "/business owner looking into his phone tracking performancepng.png",
    alt: "Business owner tracking performance",
    key: "tracking",
  },
  {
    image: "/a woman in a car and seeing how her business is performing on her phone.png",
    alt: "Woman checking business on phone",
    key: "car",
  },
  {
    image: "/happy clients using Edensystem.png",
    alt: "Happy clients using EdeniSystem",
    key: "clients",
  },
  {
    image: "/tracking performance using telephone edeni system.png",
    alt: "Tracking performance on phone",
    key: "performance",
  },
];

export default function HeroCarousel() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5000); // Change slide every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const slideKey = HERO_SLIDES[currentSlide]?.key ?? "logo";

  return (
    <section className="relative w-full min-h-[560px] md:min-h-[680px] overflow-hidden">
      {/* Background carousel */}
      <div className="absolute inset-0">
        {HERO_SLIDES.map((slide, idx) => (
          <div
            key={slide.key}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              idx === currentSlide ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={slide.image}
              alt={slide.alt}
              fill
              sizes="100vw"
              className="object-cover"
              priority={idx === 0}
            />
          </div>
        ))}
        {/* Gradient overlays for text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1f1a]/80 via-[#0a7e6b]/40 to-[#f06a2b]/40" />
        <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#f6c354]/30 blur-3xl" />
      </div>

      {/* Hero content */}
      <div className="relative z-10 h-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 flex items-center min-h-[560px] md:min-h-[680px]">
          <div className="glass-panel rounded-3xl p-8 md:p-10 max-w-2xl rise-in">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[#0a7e6b] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#0a7e6b]" />
              {t("featuresTitle")}
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-gray-900 mt-6 mb-4 leading-tight">
              {t(`heroSlides.${slideKey}.title` as any)}
            </h1>
            <p className="text-lg sm:text-xl text-gray-700 mb-8">
              {t(`heroSlides.${slideKey}.subtitle` as any)}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href={`/${locale}/login`}
                className="px-8 py-3 bg-[#0a7e6b] hover:bg-[#096657] text-white font-semibold rounded-full shadow-lg transition-colors"
              >
                {t("cta")}
              </Link>
              <Link
                href={`/${locale}/register`}
                className="px-8 py-3 bg-white hover:bg-gray-100 text-[#0a7e6b] font-semibold rounded-full shadow-lg transition-colors"
              >
                {t("ctaSecondary")}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {HERO_SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`w-3 h-3 rounded-full transition-colors ${
              idx === currentSlide ? "bg-white" : "bg-white/60"
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
