"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "use-intl";

import { API_BASE, apiGet } from "@/lib/api";
import { registerAdminForPushNotifications } from "@/lib/firebaseWebPush";
import { useConfirm } from "@/hooks/useConfirm";
import { usePrompt } from "@/hooks/usePrompt";

type Business = {
  id: number;
  name: string;
  phone?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  paid_amount_total: number;
  subscription_end_date?: string | null;
  created_at: string;
};

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export default function AdminBusinessesPage() {
  const t = useTranslations();
  const { confirm, Dialog } = useConfirm();
  const { prompt, Dialog: PromptDialog } = usePrompt();
  const router = useRouter();
  const [rows, setRows] = useState<Business[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

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

  async function doAddPayment(id: number, amount: string) {
    const res = await fetch(
      API_BASE + `/api/admin/businesses/${id}/add-payment?amount=${encodeURIComponent(amount)}`,
      { method: "POST", credentials: "include" }
    );
    if (res.ok) load();
  }

  function askAddPayment(id: number) {
    prompt(t("admin.addPayment"), t("admin.addPaymentPrompt"), "", (amount) => {
      if (!amount.trim()) return;
      doAddPayment(id, amount);
    });
  }

  async function doExtendSubscription(id: number, months: string) {
    const res = await fetch(
      API_BASE + `/api/admin/businesses/${id}/set-subscription?months=${encodeURIComponent(months)}`,
      { method: "POST", credentials: "include" }
    );
    if (res.ok) load();
  }

  function askExtendSubscription(id: number) {
    prompt(t("admin.extendSubscription"), t("admin.extendPrompt"), "1", (months) => {
      if (!months.trim()) return;
      doExtendSubscription(id, months);
    });
  }

  async function doDeleteBusiness(id: number) {
    const res = await fetch(API_BASE + `/api/admin/businesses/${id}/delete`, {
      method: "POST",
      credentials: "include"
    });
    if (res.ok) load();
  }

  function askDeleteBusiness(id: number) {
    confirm(t("admin.deleteConfirm"), () => doDeleteBusiness(id));
  }

  async function adminLogout() {
    await fetch(API_BASE + "/api/admin/logout", {
      method: "POST",
      credentials: "include",
    });
    router.push("/admin/login");
  }

  async function enableAdminPush() {
    const res = await registerAdminForPushNotifications();
    setPushStatus(res.ok ? "Notifications enabled" : (res.reason ?? "Failed"));
  }

  function getDaysLeft(endDate: string | null | undefined): number | null {
    if (!endDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate + "T00:00:00");
    return daysBetween(end, today);
  }

  function formatDate(d: string | null | undefined): string {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return d;
    }
  }

  return (
    <>
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 border-b border-black/5">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#0a7e6b] flex items-center justify-center text-white font-display font-bold text-sm">
              E
            </div>
            <div className="leading-tight">
              <div className="font-display font-semibold text-[#0e1217] text-sm">{t("admin.title")}</div>
              <div className="text-[11px] text-gray-500">EdeniSystem</div>
            </div>
          </div>
          <button
            type="button"
            onClick={adminLogout}
            className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
          >
            {t("admin.logout")}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="app-page-title">{t("admin.businesses")}</h1>
            <p className="app-page-subtitle">{t("admin.businessesHint")}</p>
          </div>
          <button className="app-btn-ghost" onClick={load} type="button">
            {t("admin.refresh")}
          </button>
          <button className="app-btn-primary" onClick={enableAdminPush} type="button">
            Enable notifications
          </button>
          {pushStatus && <span className="text-sm text-gray-600">{pushStatus}</span>}
        </div>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <div className="space-y-3">
          {rows.map((b) => {
            const daysLeft = getDaysLeft(b.subscription_end_date);
            return (
              <div key={b.id} className="app-card p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    {b.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.logo_url}
                        alt={b.name}
                        width={44}
                        height={44}
                        className="rounded-lg object-contain bg-white border border-black/5 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-[#0a7e6b]/10 flex items-center justify-center text-[#0a7e6b] font-display font-bold text-sm flex-shrink-0">
                        {b.name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">{b.name}</div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {t("admin.amountPaid", {
                          active: b.is_active ? t("admin.yes") : t("admin.no"),
                          total: b.paid_amount_total.toFixed(2)
                        })}
                      </div>
                      {b.phone ? (
                        <div className="text-sm text-gray-500">{t("admin.phone")}: {b.phone}</div>
                      ) : null}
                      <div className="text-xs text-gray-400 mt-0.5">
                        {t("admin.createdOn")}: {formatDate(b.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className={`app-badge ${b.is_active ? "app-badge-green" : "app-badge-red"}`}>
                      {b.is_active ? t("admin.active") : t("admin.no")}
                    </span>
                    {b.subscription_end_date ? (
                      <div className="text-right">
                        <div className="text-xs text-gray-500">{t("admin.subscriptionEnd")}</div>
                        <div className="text-sm font-medium text-gray-800">{formatDate(b.subscription_end_date)}</div>
                        {daysLeft !== null && (
                          <div className={`text-xs font-medium mt-0.5 ${
                            daysLeft < 0 ? "text-red-600" : daysLeft <= 7 ? "text-orange-600" : "text-green-600"
                          }`}>
                            {daysLeft < 0
                              ? t("admin.expired")
                              : t("admin.daysLeft", { days: daysLeft })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">{t("admin.noSubscription")}</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-black/5">
                  <button
                    className={b.is_active ? "app-btn-outline" : "app-btn-primary"}
                    onClick={() => setActive(b.id, !b.is_active)}
                    type="button"
                  >
                    {b.is_active ? t("admin.deactivate") : t("admin.activate")}
                  </button>
                  <button className="app-btn-ghost" onClick={() => askExtendSubscription(b.id)} type="button">
                    {t("admin.extendSubscription")}
                  </button>
                  <button className="app-btn-ghost" onClick={() => askAddPayment(b.id)} type="button">
                    {t("admin.addPayment")}
                  </button>
                  <button
                    className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-2 rounded-lg transition-colors"
                    onClick={() => askDeleteBusiness(b.id)}
                    type="button"
                  >
                    {t("admin.delete")}
                  </button>
                </div>
              </div>
            );
          })}
          {rows.length === 0 ? (
            <div className="app-card p-8 text-center text-sm text-gray-500">{t("admin.noBusinesses")}</div>
          ) : null}
        </div>
      </div>
    </main>
    <Dialog />
    <PromptDialog />
    </>
  );
}
