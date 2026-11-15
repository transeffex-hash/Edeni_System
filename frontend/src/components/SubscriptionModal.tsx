"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import { API_BASE, apiGet } from "@/lib/api";

type Payment = {
  id: number;
  start_date: string;
  end_date: string;
  amount: number;
  note: string | null;
  created_at: string;
};

type Props = {
  businessId: number;
  businessName: string;
  currentEndDate: string | null | undefined;
  onClose: () => void;
  onSaved: () => void;
};

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return toISODate(d);
}

function daysBetween(startIso: string, endIso: string): number {
  const a = new Date(startIso + "T00:00:00").getTime();
  const b = new Date(endIso + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

const PRESETS = [1, 3, 6, 12];

export default function SubscriptionModal({ businessId, businessName, currentEndDate, onClose, onSaved }: Props) {
  const t = useTranslations("admin");

  const todayIso = toISODate(new Date());
  // Default start: continue from current end date if still in the future, otherwise today.
  const defaultStart = currentEndDate && currentEndDate > todayIso ? currentEndDate : todayIso;

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(addMonths(defaultStart, 1));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Payment[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    apiGet<Payment[]>(`/api/admin/businesses/${businessId}/subscription-payments`)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [businessId]);

  const durationDays = useMemo(() => daysBetween(startDate, endDate), [startDate, endDate]);
  const valid = durationDays > 0;

  function applyPreset(months: number) {
    setEndDate(addMonths(startDate, months));
  }

  async function save() {
    if (!valid) {
      setError(t("subEndAfterStart"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/businesses/${businessId}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          amount: amount ? Number(amount) : 0,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || t("failed"));
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? t("failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-black/5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">{t("subscriptionTitle")}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{businessName}</p>
          </div>
          <button className="text-gray-400 hover:text-gray-600 text-xl" onClick={onClose} type="button">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="app-label">{t("subStart")}</label>
              <input
                type="date"
                className="app-input"
                value={startDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setStartDate(v);
                  if (v && endDate <= v) setEndDate(addMonths(v, 1));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="app-label">{t("subEnd")}</label>
              <input
                type="date"
                className="app-input"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">{t("subQuick")}:</span>
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => applyPreset(m)}
                className="text-xs px-2.5 py-1 rounded-full border border-black/10 hover:border-[#0a7e6b] hover:text-[#0a7e6b] transition-colors"
              >
                +{m} {m === 1 ? t("subMonth") : t("subMonths")}
              </button>
            ))}
          </div>

          <div className={`text-sm rounded-lg px-3 py-2 ${valid ? "bg-[#0a7e6b]/5 text-[#0a7e6b]" : "bg-red-50 text-red-600"}`}>
            {valid ? t("subDuration", { days: durationDays }) : t("subEndAfterStart")}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="app-label">{t("subAmount")}</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="app-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <label className="app-label">{t("subNote")}</label>
              <input
                className="app-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("subNotePlaceholder")}
              />
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2">
            <button className="app-btn-primary flex-1" onClick={save} disabled={saving || !valid} type="button">
              {saving ? t("subSaving") : t("subSave")}
            </button>
            <button className="app-btn-ghost" onClick={onClose} type="button">
              {t("subCancel")}
            </button>
          </div>

          <div className="pt-3 border-t border-black/5">
            <button
              type="button"
              className="text-xs font-medium text-gray-600 hover:text-gray-900"
              onClick={() => setShowHistory((v) => !v)}
            >
              {showHistory ? "▾" : "▸"} {t("subHistory")} ({history.length})
            </button>
            {showHistory && (
              history.length === 0 ? (
                <p className="text-xs text-gray-400 mt-2">{t("subNoHistory")}</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="app-table text-xs">
                    <thead>
                      <tr>
                        <th>{t("subStart")}</th>
                        <th>{t("subEnd")}</th>
                        <th>{t("subAmount")}</th>
                        <th>{t("subNote")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((p) => (
                        <tr key={p.id}>
                          <td>{p.start_date}</td>
                          <td>{p.end_date}</td>
                          <td className="font-medium">{p.amount.toLocaleString()}</td>
                          <td className="text-gray-500">{p.note ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
