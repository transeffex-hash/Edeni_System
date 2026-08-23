"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "use-intl";

import { apiGet, apiPost } from "@/lib/api";

type Entry = {
  id: number;
  ledger_type: "customer" | "supplier";
  party_name: string;
  amount: number;
  note: string | null;
  created_at: string;
  running_balance: number;
};

type Statement = {
  opening_balance: number;
  total_credit_sales: number;
  total_payments: number;
  closing_balance: number;
  outstanding_balance: number;
  entries: Entry[];
};

export default function PartyLedgerPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams<{ type: string; party: string }>();
  const type = params.type as "customer" | "supplier";
  const party = decodeURIComponent(params.party);

  const [statement, setStatement] = useState<Statement | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 50;

  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<string>("all");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  async function load(reset = false) {
    setError(null);
    try {
      const currentOffset = reset ? 0 : offset;
      let query = `?ledger_type=${type}&party_name=${encodeURIComponent(party)}&limit=${limit}&offset=${currentOffset}`;
      
      let start = "";
      let end = "";
      const now = new Date();
      
      if (filter === "today") {
        start = now.toISOString().split("T")[0] + "T00:00:00Z";
      } else if (filter === "last_7") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        start = d.toISOString().split("T")[0] + "T00:00:00Z";
      } else if (filter === "last_30") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        start = d.toISOString().split("T")[0] + "T00:00:00Z";
      } else if (filter === "this_month") {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        start = d.toISOString().split("T")[0] + "T00:00:00Z";
      } else if (filter === "custom") {
        if (customStart) start = new Date(customStart).toISOString();
        if (customEnd) {
          const d = new Date(customEnd);
          d.setHours(23, 59, 59, 999);
          end = d.toISOString();
        }
      }

      if (start) query += `&start_date=${encodeURIComponent(start)}`;
      if (end) query += `&end_date=${encodeURIComponent(end)}`;

      const data = await apiGet<Statement>(`/api/ledger/statement${query}`);
      if (reset) {
        setStatement(data);
      } else if (statement) {
        // Appending entries, while using the freshest aggregates from the latest response
        setStatement({
          ...data,
          entries: [...statement.entries, ...data.entries]
        });
      }
      setOffset(currentOffset + data.entries.length);
      setHasMore(data.entries.length === limit);
    } catch (e: any) {
      setError(e?.message ?? t("ledger.failedToLoad"));
    }
  }

  useEffect(() => {
    load(true);
  }, [type, party, filter, customStart, customEnd]);

  async function addEntry(sign: "credit" | "payment") {
    setError(null);

    if (!amount || amount <= 0) {
      setError(`${t("ledger.amount")} ${t("errors.required")}`);
      return;
    }

    const normalizedAmount = sign === "payment" ? -Math.abs(amount) : Math.abs(amount);

    try {
      await apiPost<Entry>("/api/ledger/entries", {
        ledger_type: type,
        party_name: party,
        amount: normalizedAmount,
        note: note || null
      });
      setAmount(0);
      setNote("");
      await load(true);
    } catch (e: any) {
      setError(e?.message ?? t("ledger.failedToSave"));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-sm text-gray-500">{type === "supplier" ? t("ledger.supplier") : t("ledger.customer")}</div>
          <h1 className="app-page-title">{party}</h1>
        </div>
        <button className="app-btn-ghost" onClick={() => router.back()} type="button">
          {t("ledger.back")}
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select className="app-input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">{t("ledger.allTime")}</option>
          <option value="today">{t("ledger.today")}</option>
          <option value="last_7">{t("ledger.last7")}</option>
          <option value="last_30">{t("ledger.last30")}</option>
          <option value="this_month">{t("ledger.thisMonth")}</option>
          <option value="custom">{t("ledger.customRange")}</option>
        </select>
        {filter === "custom" && (
          <>
            <input type="date" className="app-input w-auto" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            <span className="text-gray-400 text-sm">{t("ledger.to")}</span>
            <input type="date" className="app-input w-auto" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </>
        )}
      </div>

      {statement && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="app-card p-3.5 bg-[#f6f7f8]">
            <div className="text-xs text-gray-500 uppercase tracking-wide">{t("ledger.outstanding")}</div>
            <div className="text-lg font-semibold text-gray-800 mt-0.5">{statement.outstanding_balance.toFixed(2)}</div>
          </div>
          <div className="app-card p-3.5">
            <div className="text-xs text-gray-500 uppercase tracking-wide">{t("ledger.opening")}</div>
            <div className="text-lg font-semibold text-gray-800 mt-0.5">{statement.opening_balance.toFixed(2)}</div>
          </div>
          <div className="app-card p-3.5">
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              {type === "supplier" ? t("ledger.creditPurchases") : t("ledger.creditSales")}
            </div>
            <div className="text-lg font-semibold text-red-600 mt-0.5">{statement.total_credit_sales.toFixed(2)}</div>
          </div>
          <div className="app-card p-3.5">
            <div className="text-xs text-gray-500 uppercase tracking-wide">{t("ledger.payments")}</div>
            <div className="text-lg font-semibold text-green-600 mt-0.5">{statement.total_payments.toFixed(2)}</div>
          </div>
          <div className="app-card p-3.5 bg-[#f6f7f8]">
            <div className="text-xs text-gray-500 uppercase tracking-wide">{t("ledger.closing")}</div>
            <div className="text-lg font-semibold text-gray-800 mt-0.5">{statement.closing_balance.toFixed(2)}</div>
          </div>
        </div>
      )}

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="app-card p-5 space-y-3">
        <div className="font-semibold text-sm text-gray-800">{t("ledger.quickActions")}</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="app-label">{t("ledger.amount")}</label>
            <input
              className="app-input"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="app-label">{t("ledger.noteOptional")}</label>
            <input className="app-input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3">
          <button className="app-btn-primary" onClick={() => addEntry("credit")} type="button">
            {t("ledger.addCredit")}
          </button>
          <button className="app-btn-outline" onClick={() => addEntry("payment")} type="button">
            {t("ledger.recordPayment")}
          </button>
        </div>
      </div>

      <div className="app-card overflow-x-auto">
        <div className="px-5 pt-4 text-xs text-gray-500">{t("ledger.oldestFirst")}</div>
        <table className="app-table">
          <thead>
            <tr>
              <th>{t("ledger.colDate")}</th>
              <th>{t("ledger.colDescription")}</th>
              <th>{t("ledger.colDebit")}</th>
              <th>{t("ledger.colCredit")}</th>
              <th>{t("ledger.colBalance")}</th>
            </tr>
          </thead>
          <tbody>
            {statement?.entries.map((e) => {
              const dateObj = new Date(e.created_at);
              const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const defaultDesc = e.amount > 0
                ? (type === "supplier" ? t("ledger.entryCreditPurchase") : t("ledger.entryCreditSale"))
                : t("ledger.entryPayment");
              return (
                <tr key={e.id}>
                  <td className="text-gray-500">{dateStr}</td>
                  <td>{e.note || defaultDesc}</td>
                  <td className="text-red-600">{e.amount > 0 ? e.amount.toFixed(2) : "-"}</td>
                  <td className="text-green-600">{e.amount < 0 ? Math.abs(e.amount).toFixed(2) : "-"}</td>
                  <td className="font-medium">{e.running_balance.toFixed(2)}</td>
                </tr>
              );
            })}
            {statement?.entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-gray-500">{t("ledger.noEntriesPeriod")}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {hasMore && (statement?.entries.length || 0) > 0 && (
          <div className="p-3 border-t border-black/5 text-center">
            <button 
              type="button" 
              onClick={() => load(false)} 
              className="app-btn-ghost"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
