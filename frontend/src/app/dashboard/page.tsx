"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "use-intl";
import Link from "next/link";

import { useAuthStore } from "@/lib/authStore";
import { apiGet } from "@/lib/api";
import { registerForPushNotifications, onForegroundMessage } from "@/lib/firebaseWebPush";

type InventorySummary = {
  total_products: number;
  total_stock_value: number;
  low_stock_items: number;
  out_of_stock_items: number;
};

type Branch = { id: number; name: string };

export default function DashboardPage() {
  const t = useTranslations();
  const router = useRouter();
  const me = useAuthStore((s) => s.me);
  const loading = useAuthStore((s) => s.loading);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stockBranchId, setStockBranchId] = useState<string>("");
  const [stockStartDate, setStockStartDate] = useState("");
  const [stockEndDate, setStockEndDate] = useState("");
  const [stockSummary, setStockSummary] = useState<InventorySummary | null>(null);
  const [stockLoading, setStockLoading] = useState(false);

  useEffect(() => {
    (async () => {
      await refreshMe();
      setChecked(true);
    })();
  }, [refreshMe]);

  useEffect(() => {
    if (checked && !loading && !me) {
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
    }
  }, [checked, loading, me]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("notifications_enabled");
    const enabled = saved === "true";
    setNotificationsEnabled(enabled);
    if (enabled) {
      registerForPushNotifications().then((res) => {
        if (!res.ok) {
          setNotifStatus(`Notifications need re-enabling: ${res.reason}`);
          setNotificationsEnabled(false);
          localStorage.setItem("notifications_enabled", "false");
        }
      });
    }
  }, []);

  useEffect(() => {
    if (me?.role !== "boss") return;
    apiGet<Branch[]>("/api/branches").then(setBranches).catch(() => setBranches([]));
  }, [me?.role]);

  async function loadStockSummary() {
    if (me?.role !== "boss") return;
    setStockLoading(true);
    try {
      const params = new URLSearchParams();
      if (me.branch_id === null && stockBranchId) params.set("branch_id", stockBranchId);
      if (stockStartDate) params.set("start_date", `${stockStartDate}T00:00:00Z`);
      if (stockEndDate) params.set("end_date", `${stockEndDate}T23:59:59Z`);
      const query = params.toString();
      const data = await apiGet<InventorySummary>(`/api/inventory/summary${query ? `?${query}` : ""}`);
      setStockSummary(data);
    } finally {
      setStockLoading(false);
    }
  }

  useEffect(() => {
    loadStockSummary();
  }, [me?.role, me?.branch_id, stockBranchId, stockStartDate, stockEndDate]);

  useEffect(() => {
    const unsub = onForegroundMessage((payload) => {
      const { title, body } = payload.notification ?? {};
      const notifTitle = title ?? "EdeniSystem";
      const notifBody = body ?? "";
      try {
        new Notification(notifTitle, { body: notifBody, icon: "/icon-192.png" });
      } catch {
      }
    });
    return () => { unsub?.(); };
  }, []);

  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  async function toggleNotifications() {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("notifications_enabled", String(next));
    }
    if (next) {
      setNotifStatus("Requesting permission...");
      const res = await registerForPushNotifications();
      if (res.ok) {
        setNotifStatus("Notifications enabled");
      } else {
        setNotifStatus(`Failed: ${res.reason}`);
        setNotificationsEnabled(false);
        localStorage.setItem("notifications_enabled", "false");
      }
    } else {
      setNotifStatus("Notifications disabled");
    }
  }

  const quickLinks = [
    { href: "products", label: t("dashboard.productsAndStock"), emoji: "📦" },
    { href: "sell", label: t("dashboard.sellGoods"), emoji: "🛒" },
    { href: "ledger", label: t("nav.ledger"), emoji: "📒" },
    { href: "analytics", label: t("nav.analytics"), emoji: "📈" },
    { href: "reports", label: t("nav.reports"), emoji: "📊" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="app-page-title">{t("dashboard.title")}</h1>
        <p className="app-page-subtitle">
          {me ? t("dashboard.loggedInAs", { email: me.email, role: me.role }) : t("dashboard.loading")}
        </p>
        {me?.business_name && (
          <p className="text-sm text-[#0a7e6b] font-medium mt-1">{me.business_name}</p>
        )}
      </div>

      {me?.role === "boss" && (
        <div className="app-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-gray-800">{t("products.totalStockValue")}</div>
              <div className="text-xs text-gray-500 mt-0.5">Filter stock value by branch and stock-added date.</div>
            </div>
            <div className="text-2xl font-bold text-[#0a7e6b]">
              {stockLoading ? "..." : `${(stockSummary?.total_stock_value ?? 0).toLocaleString()} RWF`}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {me.branch_id === null && branches.length > 0 && (
              <select className="app-input" value={stockBranchId} onChange={(e) => setStockBranchId(e.target.value)}>
                <option value="">All branches</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            )}
            <input type="date" className="app-input" value={stockStartDate} onChange={(e) => setStockStartDate(e.target.value)} />
            <input type="date" className="app-input" value={stockEndDate} onChange={(e) => setStockEndDate(e.target.value)} />
          </div>
          {stockSummary && (
            <div className="grid grid-cols-3 gap-3 text-center text-xs text-gray-600">
              <div><div className="font-semibold text-gray-900">{stockSummary.total_products}</div>{t("products.totalProducts")}</div>
              <div><div className="font-semibold text-orange-600">{stockSummary.low_stock_items}</div>{t("products.lowStockItems")}</div>
              <div><div className="font-semibold text-red-600">{stockSummary.out_of_stock_items}</div>{t("products.outOfStockItems")}</div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            className="app-card flex flex-col items-center justify-center gap-2 p-5 text-center hover:shadow-md hover:-translate-y-0.5 transition-transform"
            href={link.href}
          >
            <span className="text-2xl">{link.emoji}</span>
            <span className="text-sm font-medium text-gray-700">{link.label}</span>
          </Link>
        ))}
      </div>

      <div className="app-card p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-gray-800">{t("dashboard.notifications")}</div>
            <div className="text-xs text-gray-500 mt-0.5">{t("dashboard.notificationsHint")}</div>
          </div>
          <button
            className={notificationsEnabled ? "app-btn-primary" : "app-btn-ghost"}
            onClick={toggleNotifications}
            type="button"
          >
            {notificationsEnabled ? t("dashboard.notificationsOn") : t("dashboard.notificationsOff")}
          </button>
        </div>
        <div className="mt-3 text-xs text-gray-500">{t("dashboard.toggleNotifications")}</div>
        {notifStatus && <div className="mt-1 text-xs text-gray-700">{notifStatus}</div>}
      </div>
    </div>
  );
}
