"use client";

import { useTranslations } from "use-intl";

export default function FeaturesSection() {
  const t = useTranslations("landing");

  const features = [
    {
      id: "ledger",
      title: t("features.ledger.title"),
      description: t("features.ledger.description"),
      tone: "#0a7e6b",
      details: [
        t("features.ledger.customerLedger"),
        t("features.ledger.supplierLedger"),
      ],
    },
    {
      id: "notifications",
      title: t("features.notifications.title"),
      description: t("features.notifications.description"),
      tone: "#f06a2b",
    },
    {
      id: "offline",
      title: t("features.offline.title"),
      description: t("features.offline.description"),
      tone: "#0c4a6e",
    },
    {
      id: "mobile",
      title: t("features.mobile.title"),
      description: t("features.mobile.description"),
      tone: "#f6c354",
    },
  ];

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-sm uppercase tracking-[0.3em] text-[#0a7e6b] font-semibold mb-4">
            EdeniSystem
          </p>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-gray-900 mb-4">
            {t("featuresTitle")}
          </h2>
          <p className="text-lg md:text-xl text-gray-700 max-w-2xl mx-auto">
            {t("featuresSubtitle")}
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-10">
          {features.map((feature, index) => (
            <div
              key={feature.id}
              className="relative rounded-3xl border border-white/70 bg-white/80 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur hover:-translate-y-1 transition-transform"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div
                className="absolute inset-x-6 -top-3 h-1 rounded-full"
                style={{ backgroundColor: feature.tone }}
              />
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-700 mb-4">{feature.description}</p>
                </div>
                <div
                  className="h-12 w-12 rounded-2xl flex items-center justify-center text-white text-lg font-semibold"
                  style={{ backgroundColor: feature.tone }}
                >
                  {String(index + 1).padStart(2, "0")}
                </div>
              </div>
              {feature.details && feature.details.length > 0 && (
                <ul className="space-y-2">
                  {feature.details.map((detail, idx) => (
                    <li key={idx} className="flex items-start text-gray-700">
                      <span className="font-semibold mr-3" style={{ color: feature.tone }}>
                        ✓
                      </span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
