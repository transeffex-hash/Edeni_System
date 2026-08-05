"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "use-intl";

export default function FeaturesSection() {
  const t = useTranslations("landing");
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in", "fade-in", "slide-in-from-bottom-8");
            entry.target.classList.remove("opacity-0");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = sectionRef.current?.querySelectorAll(".feature-card") || [];
    elements.forEach((el) => observer.observe(el));

    const header = sectionRef.current?.querySelector(".section-header");
    if (header) observer.observe(header);

    return () => observer.disconnect();
  }, []);

  const features = [
    {
      id: "ledger",
      title: t("features.ledger.title"),
      description: t("features.ledger.description"),
      tone: "#10b981",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      id: "notifications",
      title: t("features.notifications.title"),
      description: t("features.notifications.description"),
      tone: "#f59e0b",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: "mobile",
      title: t("features.mobile.title"),
      description: t("features.mobile.description"),
      tone: "#10b981",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: "offline",
      title: t("features.offline.title"),
      description: t("features.offline.description"),
      tone: "#f59e0b",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="features" ref={sectionRef} className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="section-header text-center mb-16 opacity-0 transition-all duration-700 ease-out fill-mode-forwards">
          <p className="text-sm uppercase tracking-[0.2em] text-[#0a7e6b] font-semibold mb-3">
            EDENISYSTEM
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">
            {t("featuresTitle")}
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            {t("featuresSubtitle")}
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.id}
              className="feature-card relative rounded-2xl bg-white p-8 shadow-sm hover:shadow-md border border-gray-100 flex flex-col h-full opacity-0 transition-all duration-700 ease-out fill-mode-forwards hover:-translate-y-1"
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center mb-6 shrink-0"
                style={{ backgroundColor: feature.tone }}
              >
                {feature.icon}
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-3">
                {feature.title}
              </h3>

              <p className="text-sm text-gray-500 mb-6 flex-1">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
