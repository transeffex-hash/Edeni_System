"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";

export default function AnalyticsPage() {
  const t = useTranslations();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  function onPrint() {
    if (typeof window === "undefined") return;
    window.print();
  }

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("analytics.title")}</h1>
        <div className="text-sm text-gray-600">
          {t("analytics.rangePlaceholder")}
        </div>
      </div>

      <div className="border rounded bg-white p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm">{t("analytics.start")}</label>
            <input className="w-full border rounded px-3 py-2" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm">{t("analytics.end")}</label>
            <input className="w-full border rounded px-3 py-2" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="px-3 py-2 border rounded bg-black text-white">{t("analytics.apply")}</button>
          <button className="px-3 py-2 border rounded" onClick={onPrint}>
            {t("analytics.print")}
          </button>
          <button className="px-3 py-2 border rounded disabled:opacity-50" disabled>
            {t("analytics.exportPdf")}
          </button>
          <button className="px-3 py-2 border rounded disabled:opacity-50" disabled>
            {t("analytics.importPdf")}
          </button>
        </div>

        <div className="text-sm text-gray-600">
          {t("analytics.selected", { start: startDate, end: endDate })}
        </div>

        <div className="border rounded p-3 text-sm">
          {t("analytics.placeholder")}
        </div>
      </div>
    </main>
  );
}
