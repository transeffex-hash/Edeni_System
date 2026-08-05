"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "use-intl";

import { API_BASE, apiGet } from "@/lib/api";

type Business = {
  id: number;
  name: string;
  phone?: string | null;
  is_active: boolean;
  paid_amount_total: number;
  created_at: string;
};

export default function AdminBusinessesPage() {
  const t = useTranslations();
  const router = useRouter();
  const [rows, setRows] = useState<Business[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await apiGet<Business[]>("/api/admin/businesses");
      setRows(data);
    } catch (e: any) {
      setError(e?.message ?? t("admin.failed"));
      router.push("/admin/login");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setActive(id: number, isActive: boolean) {
    const res = await fetch(
      API_BASE + `/api/admin/businesses/${id}/set-active?is_active=${isActive ? "true" : "false"}`,
      { method: "POST", credentials: "include" }
    );

    if (res.ok) load();
  }

  async function addPayment(id: number) {
    const amount = prompt(t("admin.addPaymentPrompt"));
    if (!amount) return;

    const res = await fetch(
      API_BASE + `/api/admin/businesses/${id}/add-payment?amount=${encodeURIComponent(amount)}`,
      { method: "POST", credentials: "include" }
    );

    if (res.ok) load();
  }

  async function deleteBusiness(id: number) {
    const ok = confirm(t("admin.deleteConfirm"));
    if (!ok) return;

    const res = await fetch(API_BASE + `/api/admin/businesses/${id}/delete`, {
      method: "POST",
      credentials: "include"
    });

    if (res.ok) load();
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t("admin.businesses")}</h1>
          <div className="text-sm text-gray-600">{t("admin.businessesHint")}</div>
        </div>
        <button className="px-3 py-2 border rounded" onClick={load}>
          {t("admin.refresh")}
        </button>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="border rounded bg-white divide-y">
        {rows.map((b) => (
          <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="font-medium">{b.name}</div>
              <div className="text-sm text-gray-600">
                {t("admin.amountPaid", {
                  active: b.is_active ? t("admin.yes") : t("admin.no"),
                  total: b.paid_amount_total.toFixed(2)
                })}
              </div>
              {b.phone ? <div className="text-sm text-gray-600">{t("admin.phone")}: {b.phone}</div> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="px-3 py-2 border rounded bg-black text-white"
                onClick={() => setActive(b.id, !b.is_active)}
              >
                {b.is_active ? t("admin.deactivate") : t("admin.activate")}
              </button>
              <button className="px-3 py-2 border rounded" onClick={() => addPayment(b.id)}>
                {t("admin.addPayment")}
              </button>
              <button className="px-3 py-2 border rounded border-red-300 text-red-700" onClick={() => deleteBusiness(b.id)}>
                {t("admin.delete")}
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 ? <div className="p-3 text-sm">{t("admin.noBusinesses")}</div> : null}
      </div>
    </main>
  );
}
