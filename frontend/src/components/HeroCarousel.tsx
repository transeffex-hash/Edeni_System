"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "use-intl";
import { apiGet } from "@/lib/api";

interface HeroSlide {
  image: string;
  alt: string;
  key: string;
}

const HERO_MESSAGES = [
  {
    title: "Yibanda kuri Telefoni",
    body: "Yakozwe nk'aho ari app kuri telefone, irihuta, irasukuye kandi irizewe.",
  },
  {
    title: "Genzura Stock Byoroshye",
    body: "Menya ibicuruzwa biri kurangira, ibigiye kurangiza igihe n'ibicuruzwa bicuruzwa cyane.",
  },
  {
    title: "Gurisha Vuba",
    body: "Abacashier bakora sales mu buryo bwihuse, busukuye kandi bugabanya amakosa.",
  },
  {
    title: "Raporo Zisobanutse",
    body: "Boss abona uko business ihagaze, amadeni, inyungu n'ibikorwa by'ingenzi igihe cyose.",
  },
];

const HERO_SLIDES: HeroSlide[] = [
  {
    image: "/edeni system logo.png",
    alt: "EdeniSystem Logo",
    key: "logo",
  },
  {
    image: "/a woman in a car and seeing how her business is performing on her phone.png",
    alt: "Wholesaler managing stock",
    key: "tracking",
  },
  {
    image: "/woman selling clothes edeni system.avif",
    alt: "Woman selling clothes",
    key: "clothes",
  },
  {
    image: "/business owner looking into his phone tracking performancepng.png",
    alt: "Business owner tracking performance",
    key: "owner-tracking",
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
  const [currentMessage, setCurrentMessage] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState({ users: 500, businesses: 2500, products: 50000 });

  useEffect(() => {
    setMounted(true);
    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    const messageInterval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % HERO_MESSAGES.length);
    }, 6500);
    
    // Fetch real statistics
    apiGet<{users: number, businesses: number, products: number}>("/api/public/stats")
      .then(data => {
         if (data) {
           setStats(data);
         }
      })
      .catch(e => console.error("Failed to load public stats", e));

    return () => {
      clearInterval(slideInterval);
      clearInterval(messageInterval);
    };
  }, []);

  const activeMessage = HERO_MESSAGES[currentMessage] ?? HERO_MESSAGES[0];
  const formatStat = (value: number) => (mounted ? value.toLocaleString() : String(value));

  return (
    <section className="relative w-full min-h-[600px] md:min-h-[750px] overflow-hidden bg-[#064e3b]">
      {/* Background carousel on the right side */}
      <div className="absolute inset-0 md:left-[40%]">
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
        {/* Soft mask to fade image into the green background */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#064e3b] via-[#064e3b]/80 to-transparent md:bg-gradient-to-r md:from-[#064e3b] md:via-[#064e3b]/30 md:to-transparent" />
      </div>

      {/* Hero content */}
      <div className="relative z-10 h-full pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 flex items-center">
          <div className="max-w-2xl rise-in">
            {/* Pill */}
            <div className="inline-flex items-center gap-2 rounded-full bg-[#047857]/60 border border-[#059669] px-4 py-1.5 text-sm font-medium text-white shadow-sm mb-8">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              {t("featuresTitle")}
            </div>
            
            {/* Typography */}
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-white mt-2 mb-6 leading-tight transition-opacity duration-500">
              {activeMessage.title}
            </h1>
            <p className="text-lg sm:text-xl text-gray-200 mb-10 max-w-lg transition-opacity duration-500">
              {activeMessage.body}
            </p>
            
            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href={`/${locale}/login`}
                className="px-8 py-3.5 bg-[#059669] hover:bg-[#047857] text-white font-medium rounded-full shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                Tangira
              </Link>
              <Link
                href={`/${locale}/register`}
                className="px-8 py-3.5 bg-white hover:bg-gray-50 text-[#064e3b] font-medium rounded-full shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Iyandikishe Hano
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom curve SVG */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10">
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="relative block w-full h-[60px] md:h-[120px]"
          style={{ transform: "rotate(180deg)" }}
        >
          <path
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C59.71,118,137.93,128.5,207.2,122.9,245.92,119.78,284.14,106.62,321.39,56.44Z"
            fill="#f6f2ea"
          ></path>
        </svg>
      </div>

      {/* Floating Stats Card (Overlaps the curve) */}
      <div className="absolute bottom-4 md:bottom-10 left-1/2 -translate-x-1/2 z-20 w-full max-w-5xl px-4">
        <div className="bg-white rounded-2xl md:rounded-full shadow-2xl py-6 px-8 flex flex-wrap md:flex-nowrap items-center justify-around gap-6">
          <div className="flex items-center gap-3">
            <div className="text-[#059669]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            </div>
            <div>
              <div className="font-bold text-gray-900">{formatStat(stats.users)}+</div>
              <div className="text-sm text-gray-500">Abakoresha</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[#059669]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
            </div>
            <div>
              <div className="font-bold text-gray-900">{formatStat(stats.businesses)}+</div>
              <div className="text-sm text-gray-500">Amaduka</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[#059669]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
            </div>
            <div>
              <div className="font-bold text-gray-900">{formatStat(stats.products)}+</div>
              <div className="text-sm text-gray-500">Ibicuruzwa</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[#059669]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            </div>
            <div>
              <div className="font-bold text-gray-900">99.9%</div>
              <div className="text-sm text-gray-500">Umutekano</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
