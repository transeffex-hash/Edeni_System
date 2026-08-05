"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "use-intl";

import { apiGet } from "@/lib/api";

type Balance = { party_name: string; balance: number };

export default function LedgerHomePage() {
  const t = useTranslations();
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("ledger.title")}</h1>
        <select className="border rounded px-3 py-2" value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="customer">{t("ledger.customer")}</option>
          <option value="supplier">{t("ledger.supplier")}</option>
        </select>
      </div>

      <div className="text-sm text-gray-600">
        {t("ledger.hint")}
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="border rounded divide-y">
        {rows.map((r) => (
          <Link
            key={r.party_name}
            className="block p-3 hover:bg-gray-50"
            href={`/ledger/${type}/${encodeURIComponent(r.party_name)}`}
          >
            <div className="flex items-center justify-between">
              <div className="font-medium">{r.party_name}</div>
              <div className="text-sm">{r.balance.toFixed(2)}</div>
            </div>
          </Link>
        ))}
        {rows.length === 0 ? <div className="p-3 text-sm">{t("ledger.noEntries")}</div> : null}
        {hasMore && rows.length > 0 && (
          <div className="p-3 border-t text-center">
            <button 
              type="button" 
              onClick={() => load(false)} 
              className="text-sm px-4 py-2 border rounded hover:bg-gray-50"
            >
              {t("common.loadMore") || "Load More"}
            </button>
          </div>
        )}
      </div>

      <div className="border rounded p-3">
        <div className="font-medium">{t("ledger.quickActions")}</div>
        <div className="mt-2 text-sm text-gray-600">
          {t("ledger.quickActionsHint")}
        </div>
      </div>
    </div>
  );
}
