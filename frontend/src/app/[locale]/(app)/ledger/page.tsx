"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "use-intl";

import { apiGet } from "@/lib/api";

type Balance = { party_name: string; balance: number };

export default function LedgerHomePage() {
  const t = useTranslations();
  const locale = useLocale();
  const [type, setType] = useState<"customer" | "supplier">("customer");
  const [rows, setRows] = useState<Balance[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 50;
  
  const [error, setError] = useState<string | null>(null);

  async function load(reset = false) {
    setError(null);
    try {
      const currentOffset = reset ? 0 : offset;
      const data = await apiGet<Balance[]>(`/api/ledger/balances?ledger_type=${type}&limit=${limit}&offset=${currentOffset}`);
      if (reset) {
        setRows(data);
      } else {
        setRows((prev) => [...prev, ...data]);
      }
      setOffset(currentOffset + data.length);
      setHasMore(data.length === limit);
    } catch (e: any) {
      setError(e?.message ?? t("ledger.failedToLoad"));
    }
  }

  useEffect(() => {
    load(true);
  }, [type]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="app-page-title">{t("ledger.title")}</h1>
        <select className="app-input w-auto" value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="customer">{t("ledger.customer")}</option>
          <option value="supplier">{t("ledger.supplier")}</option>
        </select>
      </div>

      <div className="text-sm text-gray-500">
        {t("ledger.hint")}
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="app-card overflow-hidden">
        {rows.map((r) => (
          <Link
            key={r.party_name}
            className="app-list-row"
            href={`/${locale}/ledger/${type}/${encodeURIComponent(r.party_name)}`}
          >
            <div className="font-medium text-gray-800">{r.party_name}</div>
            <div className={`text-sm font-semibold ${r.balance > 0 ? "text-red-600" : "text-green-600"}`}>{r.balance.toFixed(2)}</div>
          </Link>
        ))}
        {rows.length === 0 ? <div className="p-5 text-sm text-gray-500 text-center">{t("ledger.noEntries")}</div> : null}
        {hasMore && rows.length > 0 && (
          <div className="p-3 border-t border-black/5 text-center">
            <button 
              type="button" 
              onClick={() => load(false)} 
              className="app-btn-ghost"
            >
              {t("common.loadMore") || "Load More"}
            </button>
          </div>
        )}
      </div>

      <div className="app-card p-4">
        <div className="font-semibold text-sm text-gray-800">{t("ledger.quickActions")}</div>
        <div className="mt-1.5 text-sm text-gray-500">
          {t("ledger.quickActionsHint")}
        </div>
      </div>
    </div>
  );
}
