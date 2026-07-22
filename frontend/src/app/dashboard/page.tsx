"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "use-intl";
import Link from "next/link";

import { useAuthStore } from "@/lib/authStore";

export default function DashboardPage() {
  const t = useTranslations();
  const router = useRouter();
  const me = useAuthStore((s) => s.me);
  const loading = useAuthStore((s) => s.loading);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      await refreshMe();
    })();
  }, [refreshMe]);

  useEffect(() => {
    if (!loading && !me) router.push("login");
  }, [loading, me, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("notifications_enabled");
    setNotificationsEnabled(saved === "true");
  }, []);

  function toggleNotifications() {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("notifications_enabled", String(next));
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold">{t("dashboard.title")}</h1>
      <p className="mt-2 text-sm text-gray-600">
        {me ? `Logged in as ${me.email} (${me.role})` : "Loading..."}
      </p>

      <div className="mt-6 space-y-3">
        <Link className="block border rounded p-3" href="products">
          {t("dashboard.productsAndStock")}
        </Link>
        <Link className="block border rounded p-3" href="sell">
          {t("dashboard.sellGoods")}
        </Link>
        <Link className="block border rounded p-3" href="ledger">
          {t("nav.ledger")}
        </Link>
        <Link className="block border rounded p-3" href="analytics">
          {t("nav.analytics")}
        </Link>
      </div>

      <div className="mt-8 border rounded p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{t("dashboard.notifications")}</div>
            <div className="text-xs text-gray-600">{t("dashboard.notificationsHint")}</div>
          </div>
          <button
            className={`px-3 py-1 rounded text-xs ${
              notificationsEnabled ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800"
            }`}
            onClick={toggleNotifications}
            type="button"
          >
            {notificationsEnabled ? t("dashboard.notificationsOn") : t("dashboard.notificationsOff")}
          </button>
        </div>
        <div className="mt-3 text-xs text-gray-500">{t("dashboard.toggleNotifications")}</div>
      </div>
    </main>
  );
}
